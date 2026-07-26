-- Migration 023: ephemeral identity verification + transfer lock
-- ADR: docs/ADR/0009-verificacion-identidad-efimera.md
-- NO document storage, NO file/path/url columns.

-- ---------------------------------------------------------------------------
-- 1. season_rules + players.verification_status
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_rules
  ADD COLUMN require_player_verification boolean NOT NULL DEFAULT false,
  ADD COLUMN transfer_lock_days integer NOT NULL DEFAULT 0;

ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_transfer_lock_days_non_negative_check
  CHECK (transfer_lock_days >= 0);

ALTER TABLE public.players
  ADD COLUMN verification_status text NOT NULL DEFAULT 'not_required';

ALTER TABLE public.players
  ADD CONSTRAINT players_verification_status_check CHECK (
    verification_status IN ('not_required', 'pending', 'approved', 'rejected')
  );

COMMENT ON COLUMN public.players.verification_status IS
  'Org-scoped identity verification state. No document storage (ADR 0009).';

COMMENT ON COLUMN public.season_rules.require_player_verification IS
  'When true, players pending/rejected cannot be activated in this season (admin bypass).';

COMMENT ON COLUMN public.season_rules.transfer_lock_days IS
  'Days after roster deactivation before a captain may activate the player on another season_team in the same season. 0 = off.';

-- Protect verification_status from direct client updates
CREATE OR REPLACE FUNCTION public.players_protect_verification_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF current_setting('app.player_verification_update', true) <> 'true' THEN
      RAISE EXCEPTION
        'players.verification_status is managed via verification RPCs only'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS players_protect_verification_status ON public.players;
CREATE TRIGGER players_protect_verification_status
  BEFORE UPDATE OF verification_status
  ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.players_protect_verification_status();

-- ---------------------------------------------------------------------------
-- 2. player_verification_reviews (decision audit; no documents)
-- ---------------------------------------------------------------------------
CREATE TABLE public.player_verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players (id) ON DELETE CASCADE,
  status text NOT NULL,
  reviewed_by_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  CONSTRAINT player_verification_reviews_status_check CHECK (
    status IN ('approved', 'rejected')
  ),
  CONSTRAINT player_verification_reviews_reject_reason_check CHECK (
    status <> 'rejected'
    OR (
      reason IS NOT NULL
      AND btrim(reason) <> ''
    )
  )
);

CREATE INDEX player_verification_reviews_player_id_idx
  ON public.player_verification_reviews (player_id);
CREATE INDEX player_verification_reviews_organization_id_idx
  ON public.player_verification_reviews (organization_id);

CREATE OR REPLACE FUNCTION public.player_verification_reviews_enforce_org_matches_player()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_org uuid;
BEGIN
  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_player_org THEN
    RAISE EXCEPTION
      'player_verification_reviews.organization_id (%) must match players.organization_id (%)',
      NEW.organization_id,
      v_player_org
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER player_verification_reviews_enforce_org_matches_player
  BEFORE INSERT OR UPDATE OF organization_id, player_id
  ON public.player_verification_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.player_verification_reviews_enforce_org_matches_player();

-- ---------------------------------------------------------------------------
-- 3. player_transfer_lock_releases (admin exceptions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.player_transfer_lock_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  released_by_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  released_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  CONSTRAINT player_transfer_lock_releases_reason_not_empty_check CHECK (
    btrim(reason) <> ''
  )
);

CREATE INDEX player_transfer_lock_releases_player_season_idx
  ON public.player_transfer_lock_releases (player_id, season_id, released_at DESC);

CREATE OR REPLACE FUNCTION public.player_transfer_lock_releases_enforce_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_org uuid;
  v_season_org uuid;
BEGIN
  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_player_org
     OR NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION
      'player_transfer_lock_releases.organization_id must match player and season'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER player_transfer_lock_releases_enforce_org
  BEFORE INSERT OR UPDATE OF organization_id, player_id, season_id
  ON public.player_transfer_lock_releases
  FOR EACH ROW
  EXECUTE FUNCTION public.player_transfer_lock_releases_enforce_org();

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__can_request_player_verification(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_player_id
      AND (
        public.has_role_in_org(
          p.organization_id,
          ARRAY['organization_owner', 'organization_admin']::text[]
        )
        OR EXISTS (
          SELECT 1
          FROM public.season_team_players stp
          WHERE stp.player_id = p_player_id
            AND stp.registration_status = 'active'
            AND public.is_active_captain_or_vice_of_season_team(
              stp.season_team_id,
              auth.uid()
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.__assert_player_activation_allowed(
  p_player_id uuid,
  p_season_id uuid,
  p_target_season_team_id uuid,
  p_bypass boolean
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_require boolean;
  v_verification text;
  v_lock_days integer;
  v_last_team uuid;
  v_released_at timestamptz;
  v_admin_release timestamptz;
BEGIN
  IF p_bypass THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(sr.require_player_verification, false),
    p.verification_status,
    COALESCE(sr.transfer_lock_days, 0)
  INTO v_require, v_verification, v_lock_days
  FROM public.players p
  LEFT JOIN public.season_rules sr ON sr.season_id = p_season_id
  WHERE p.id = p_player_id;

  IF v_require
     AND v_verification IN ('pending', 'rejected') THEN
    RAISE EXCEPTION
      'Player identity verification must be approved before activation in this season'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_lock_days <= 0 THEN
    RETURN;
  END IF;

  -- Last roster the player left in this season (inactive row, most recent updated_at).
  SELECT stp.season_team_id, stp.updated_at
  INTO v_last_team, v_released_at
  FROM public.season_team_players stp
  WHERE stp.player_id = p_player_id
    AND stp.season_id = p_season_id
    AND stp.registration_status = 'inactive'
    AND stp.season_team_id IS DISTINCT FROM p_target_season_team_id
  ORDER BY stp.updated_at DESC
  LIMIT 1;

  IF v_last_team IS NULL THEN
    RETURN;
  END IF;

  SELECT MAX(ptlr.released_at) INTO v_admin_release
  FROM public.player_transfer_lock_releases ptlr
  WHERE ptlr.player_id = p_player_id
    AND ptlr.season_id = p_season_id;

  IF v_admin_release IS NOT NULL AND v_admin_release >= v_released_at THEN
    RETURN;
  END IF;

  IF now() < v_released_at + make_interval(days => v_lock_days) THEN
    RAISE EXCEPTION
      'Transfer lock is active for this player in this season (% days remaining policy)',
      v_lock_days
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC request_player_verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_player_verification(p_player_id uuid)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.players;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_player_id IS NULL THEN
    RAISE EXCEPTION 'Player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.players
  WHERE id = p_player_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', p_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.__can_request_player_verification(p_player_id) THEN
    RAISE EXCEPTION 'Not authorized to request verification for player %', p_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.verification_status = 'pending' THEN
    RAISE EXCEPTION 'Player % verification is already pending', p_player_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.player_verification_update', 'true', true);

  UPDATE public.players
  SET
    verification_status = 'pending',
    updated_at = now()
  WHERE id = p_player_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC review_player_verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_player_verification(
  p_player_id uuid,
  p_approved boolean,
  p_reason text DEFAULT NULL
)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.players;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_player_id IS NULL THEN
    RAISE EXCEPTION 'Player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.players
  WHERE id = p_player_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', p_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to review verification for player %', p_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_approved THEN
    v_status := 'approved';
  ELSE
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'Rejection reason is required'
        USING ERRCODE = 'P0001';
    END IF;
    v_status := 'rejected';
  END IF;

  INSERT INTO public.player_verification_reviews (
    organization_id,
    player_id,
    status,
    reviewed_by_profile_id,
    reason
  ) VALUES (
    v_row.organization_id,
    p_player_id,
    v_status,
    auth.uid(),
    v_reason
  );

  PERFORM set_config('app.player_verification_update', 'true', true);

  UPDATE public.players
  SET
    verification_status = v_status,
    updated_at = now()
  WHERE id = p_player_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC release_player_transfer_lock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_player_transfer_lock(
  p_player_id uuid,
  p_season_id uuid,
  p_reason text
)
RETURNS public.player_transfer_lock_releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_row public.player_transfer_lock_releases;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_player_id IS NULL OR p_season_id IS NULL THEN
    RAISE EXCEPTION 'Player id and season id are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Release reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.organization_id INTO v_org
  FROM public.players p
  WHERE p.id = p_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', p_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.seasons s
    WHERE s.id = p_season_id
      AND s.organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Season % does not exist in this organization', p_season_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to release transfer lock'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.player_transfer_lock_releases (
    organization_id,
    player_id,
    season_id,
    released_by_profile_id,
    reason
  ) VALUES (
    v_org,
    p_player_id,
    p_season_id,
    auth.uid(),
    v_reason
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. add_player_to_season_team — verification + transfer lock gates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_player_to_season_team(
  p_season_team_id uuid,
  p_player_id uuid,
  p_jersey_number integer DEFAULT NULL,
  p_registration_status text DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_season_id uuid;
  v_player_org uuid;
  v_status text;
  v_existing public.season_team_players;
  v_id uuid;
  v_is_admin boolean;
  v_is_leader boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL OR p_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team id and player id are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id, st.season_id
  INTO v_org_id, v_season_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = p_player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_org_id IS DISTINCT FROM v_player_org THEN
    RAISE EXCEPTION 'Player and season team must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  );
  v_is_leader := public.is_active_captain_or_vice_of_season_team(
    p_season_team_id,
    v_uid
  );

  IF NOT v_is_admin AND NOT v_is_leader THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_leader AND NOT v_is_admin THEN
    PERFORM public.__assert_captain_roster_add_allowed(p_season_team_id);
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'active');
  IF v_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'active' THEN
    PERFORM public.__assert_player_activation_allowed(
      p_player_id,
      v_season_id,
      p_season_team_id,
      v_is_admin
    );
  END IF;

  IF p_jersey_number IS NOT NULL AND p_jersey_number <= 0 THEN
    RAISE EXCEPTION 'Jersey number must be greater than zero'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.registration_status = 'active' THEN
      RAISE EXCEPTION 'Player is already on this roster'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.season_team_players
    SET
      registration_status = v_status,
      jersey_number = p_jersey_number,
      is_captain = false,
      is_vice_captain = false
    WHERE id = v_existing.id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  INSERT INTO public.season_team_players (
    season_team_id,
    player_id,
    organization_id,
    jersey_number,
    is_captain,
    registration_status
  ) VALUES (
    p_season_team_id,
    p_player_id,
    v_org_id,
    p_jersey_number,
    false,
    v_status
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. set_season_team_player_status — verification + transfer lock on active
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
  v_player_id uuid;
  v_season_id uuid;
  v_season_team_id uuid;
  v_status text;
  v_updated integer;
  v_is_admin boolean;
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

  SELECT
    stp.organization_id,
    stp.player_id,
    stp.season_id,
    stp.season_team_id
  INTO v_org_id, v_player_id, v_season_id, v_season_team_id
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  );

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'active' THEN
    PERFORM public.__assert_player_activation_allowed(
      v_player_id,
      v_season_id,
      v_season_team_id,
      true
    );
  END IF;

  IF v_status IN ('inactive', 'suspended') THEN
    UPDATE public.season_team_players
    SET
      registration_status = v_status,
      is_captain = false,
      is_vice_captain = false
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

-- ---------------------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_verification_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_transfer_lock_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_verification_reviews_select_member
  ON public.player_verification_reviews FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY player_transfer_lock_releases_select_owner_or_admin
  ON public.player_transfer_lock_releases FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.player_verification_reviews FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.player_transfer_lock_releases FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.player_verification_reviews TO authenticated;
GRANT SELECT ON TABLE public.player_transfer_lock_releases TO authenticated;

REVOKE ALL ON FUNCTION public.__can_request_player_verification(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.__assert_player_activation_allowed(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.request_player_verification(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_player_verification(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_player_transfer_lock(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_player_verification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_player_verification(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_player_transfer_lock(uuid, uuid, text) TO authenticated;

COMMENT ON TABLE public.player_verification_reviews IS
  'Admin review decisions for player identity verification. No document storage (ADR 0009).';

COMMENT ON TABLE public.player_transfer_lock_releases IS
  'Point-in-time admin release of transfer lock for a player in a season.';

COMMENT ON FUNCTION public.__assert_player_activation_allowed(uuid, uuid, uuid, boolean) IS
  'Verification + transfer lock gates for roster activation. Transfer release date = season_team_players.updated_at when status became inactive.';
