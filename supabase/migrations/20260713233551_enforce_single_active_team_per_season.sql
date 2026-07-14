-- Migration 015: one active|suspended roster seat per player per season
-- Denormalizes season_id on season_team_players for a concurrent-safe unique index.
-- Rule: active and suspended occupy the seat; inactive frees it (history kept).

-- ---------------------------------------------------------------------------
-- 1. Add season_id (nullable) and backfill
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_team_players
  ADD COLUMN IF NOT EXISTS season_id uuid;

UPDATE public.season_team_players stp
SET season_id = st.season_id
FROM public.season_teams st
WHERE st.id = stp.season_team_id
  AND stp.season_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.season_team_players
    WHERE season_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Migration 015 abort: season_team_players.season_id still NULL after backfill'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

ALTER TABLE public.season_team_players
  ALTER COLUMN season_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'season_team_players_season_id_fkey'
      AND conrelid = 'public.season_team_players'::regclass
  ) THEN
    ALTER TABLE public.season_team_players
      ADD CONSTRAINT season_team_players_season_id_fkey
      FOREIGN KEY (season_id) REFERENCES public.seasons (id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS season_team_players_season_id_idx
  ON public.season_team_players (season_id);

CREATE INDEX IF NOT EXISTS season_team_players_season_id_player_id_idx
  ON public.season_team_players (season_id, player_id);

-- ---------------------------------------------------------------------------
-- 2. Context trigger: derive season_id + organization_id from season_team
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.season_team_players_set_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_season_team_org uuid;
  v_player_org uuid;
BEGIN
  SELECT st.season_id, st.organization_id
  INTO v_season_id, v_season_team_org
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_season_id IS NULL OR v_season_team_org IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Always derive from season_team_id; ignore client-supplied values.
  NEW.season_id := v_season_id;
  NEW.organization_id := v_season_team_org;

  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_player_org THEN
    RAISE EXCEPTION
      'season_team_players.organization_id (%) must match players.organization_id (%) for player %',
      NEW.organization_id,
      v_player_org,
      NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Legacy name kept in sync for any external references.
CREATE OR REPLACE FUNCTION public.season_team_players_enforce_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_season_team_org uuid;
  v_player_org uuid;
BEGIN
  SELECT st.season_id, st.organization_id
  INTO v_season_id, v_season_team_org
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_season_id IS NULL OR v_season_team_org IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  NEW.season_id := v_season_id;
  NEW.organization_id := v_season_team_org;

  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_player_org THEN
    RAISE EXCEPTION
      'season_team_players.organization_id (%) must match players.organization_id (%) for player %',
      NEW.organization_id,
      v_player_org,
      NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS season_team_players_enforce_org_consistency
  ON public.season_team_players;
DROP TRIGGER IF EXISTS season_team_players_set_context
  ON public.season_team_players;

CREATE TRIGGER season_team_players_set_context
  BEFORE INSERT OR UPDATE OF season_team_id, player_id, organization_id, season_id
  ON public.season_team_players
  FOR EACH ROW
  EXECUTE FUNCTION public.season_team_players_set_context();

-- ---------------------------------------------------------------------------
-- 3. Unique partial index (concurrency-safe seat)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS
  season_team_players_one_active_or_suspended_per_season
  ON public.season_team_players (season_id, player_id)
  WHERE registration_status IN ('active', 'suspended');

-- ---------------------------------------------------------------------------
-- 4. set_season_team_player_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_season_team_player_status(
  p_season_team_player_id uuid,
  p_registration_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_status text;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := NULLIF(btrim(COALESCE(p_registration_status, '')), '');
  IF v_status IS NULL OR v_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id INTO v_org_id
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('inactive', 'suspended') THEN
    UPDATE public.season_team_players
    SET
      registration_status = v_status,
      is_captain = false
    WHERE id = p_season_team_player_id
      AND organization_id = v_org_id;
  ELSE
    UPDATE public.season_team_players
    SET registration_status = v_status
    WHERE id = p_season_team_player_id
      AND organization_id = v_org_id;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update roster status'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_season_team_player_status(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_team_player_status(uuid, text)
  TO authenticated;

-- Keep deactivate as a typed inactive helper (same captain clear semantics).
CREATE OR REPLACE FUNCTION public.deactivate_season_team_player(
  p_season_team_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_season_team_player_status(
    p_season_team_player_id,
    'inactive'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_season_team_player(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_season_team_player(uuid)
  TO authenticated;
