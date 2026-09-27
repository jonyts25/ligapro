-- Migration 031: match participation (convocatoria + validación de plantel)
-- Single source of truth for called / confirmed / declined / played / no_show.

-- =============================================================================
-- 1) match_participants table
-- =============================================================================
CREATE TABLE public.match_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  season_team_player_id uuid NOT NULL REFERENCES public.season_team_players (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'called',
  called_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_participants_status_check CHECK (
    status IN ('called', 'confirmed', 'declined', 'played', 'no_show')
  ),
  CONSTRAINT match_participants_match_player_unique UNIQUE (match_id, season_team_player_id)
);

CREATE INDEX match_participants_match_id_idx
  ON public.match_participants (match_id);
CREATE INDEX match_participants_organization_id_idx
  ON public.match_participants (organization_id);
CREATE INDEX match_participants_season_team_player_id_idx
  ON public.match_participants (season_team_player_id);

CREATE TRIGGER match_participants_set_updated_at
  BEFORE UPDATE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.match_participants_enforce_org_matches_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_org uuid;
  v_player_org uuid;
BEGIN
  SELECT m.organization_id INTO v_match_org
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_match_org IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', NEW.match_id USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_match_org THEN
    RAISE EXCEPTION 'organization_id must match match organization'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id INTO v_player_org
  FROM public.season_team_players stp
  WHERE stp.id = NEW.season_team_player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Season team player % does not exist', NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_player_org IS DISTINCT FROM v_match_org THEN
    RAISE EXCEPTION 'season_team_player must belong to the match organization'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_participants_enforce_org
  BEFORE INSERT OR UPDATE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.match_participants_enforce_org_matches_match();

ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_participants_select_member
  ON public.match_participants FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

REVOKE ALL ON TABLE public.match_participants FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.match_participants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.match_participants TO authenticated;

CREATE TRIGGER audit_match_participants
  AFTER INSERT OR UPDATE OR DELETE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

COMMENT ON TABLE public.match_participants IS
  'Per-match roster participation: convocatoria (called/confirmed/declined) and referee validation (played/no_show).';

-- =============================================================================
-- 2) Helpers
-- =============================================================================
CREATE OR REPLACE FUNCTION public.__assert_match_open_for_participation(p_match_id uuid)
RETURNS public.matches
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
BEGIN
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id USING ERRCODE = 'P0001';
  END IF;

  IF v_match.status IN ('finished', 'walkover', 'cancelled') THEN
    RAISE EXCEPTION
      'Cannot modify participation for a closed match (status: %)',
      v_match.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_match_open_for_participation(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.__assert_match_open_for_participation(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.is_confirmed_match_referee_or_scorekeeper(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_officials mo
    WHERE mo.match_id = p_match_id
      AND mo.profile_id = auth.uid()
      AND mo.status = 'confirmed'
      AND mo.role IN ('referee', 'scorekeeper')
  );
$$;

REVOKE ALL ON FUNCTION public.is_confirmed_match_referee_or_scorekeeper(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_confirmed_match_referee_or_scorekeeper(uuid)
  TO authenticated;

-- =============================================================================
-- 3) set_match_participants
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_match_participants(
  p_match_id uuid,
  p_season_team_player_ids uuid[],
  p_status text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_status text := btrim(COALESCE(p_status, ''));
  v_is_privileged boolean;
  v_can_capture boolean;
  v_captain_team uuid;
  v_player_id uuid;
  v_player_team uuid;
  v_team_set uuid[] := ARRAY[]::uuid[];
  v_affected integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  v_match := public.__assert_match_open_for_participation(p_match_id);

  IF p_season_team_player_ids IS NULL OR array_length(p_season_team_player_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one season_team_player_id is required' USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('called', 'confirmed', 'declined') THEN
    RAISE EXCEPTION 'Invalid participation status for set_match_participants: %', v_status
      USING ERRCODE = 'P0001';
  END IF;

  v_is_privileged := (
    public.has_role_in_org(
      v_match.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(v_match.season_id, ARRAY['tournament_admin']::text[])
  );
  v_can_capture := public.can_capture_match(p_match_id);

  IF NOT (v_is_privileged OR v_can_capture) THEN
    v_captain_team := public.__captain_season_team_for_match(p_match_id, auth.uid());
    IF v_captain_team IS NULL THEN
      RAISE EXCEPTION 'Not authorized to set match participants for match %', p_match_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  FOREACH v_player_id IN ARRAY p_season_team_player_ids LOOP
    SELECT stp.season_team_id INTO v_player_team
    FROM public.season_team_players stp
    WHERE stp.id = v_player_id
      AND stp.organization_id = v_match.organization_id;

    IF v_player_team IS NULL THEN
      RAISE EXCEPTION 'season_team_player % is not on this match roster', v_player_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_player_team NOT IN (v_match.home_season_team_id, v_match.away_season_team_id) THEN
      RAISE EXCEPTION 'season_team_player % does not belong to either team in this match', v_player_id
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT (v_is_privileged OR v_can_capture) THEN
      IF v_player_team IS DISTINCT FROM v_captain_team THEN
        RAISE EXCEPTION 'Captain can only set participants for their own team'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    IF NOT v_player_team = ANY (v_team_set) THEN
      v_team_set := array_append(v_team_set, v_player_team);
    END IF;
  END LOOP;

  IF NOT (v_is_privileged OR v_can_capture) AND array_length(v_team_set, 1) > 1 THEN
    RAISE EXCEPTION 'Captain can only set participants for one team at a time'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.match_participants (
    match_id,
    season_team_player_id,
    organization_id,
    status,
    called_by_profile_id,
    responded_at
  )
  SELECT
    p_match_id,
    stp.id,
    v_match.organization_id,
    v_status,
    CASE WHEN v_status = 'called' THEN auth.uid() ELSE mp.called_by_profile_id END,
    CASE
      WHEN v_status IN ('confirmed', 'declined') THEN now()
      ELSE mp.responded_at
    END
  FROM unnest(p_season_team_player_ids) AS pid(id)
  JOIN public.season_team_players stp ON stp.id = pid.id
  LEFT JOIN public.match_participants mp
    ON mp.match_id = p_match_id
   AND mp.season_team_player_id = stp.id
  ON CONFLICT (match_id, season_team_player_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    called_by_profile_id = EXCLUDED.called_by_profile_id,
    responded_at = EXCLUDED.responded_at,
    updated_at = now();

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_participants(uuid, uuid[], text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_match_participants(uuid, uuid[], text)
  TO authenticated;

-- =============================================================================
-- 4) validate_match_roster
-- =============================================================================
CREATE OR REPLACE FUNCTION public.validate_match_roster(
  p_match_id uuid,
  p_season_team_player_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_is_privileged boolean;
  v_player_id uuid;
  v_player_team uuid;
  v_played_count integer := 0;
  v_no_show_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  v_match := public.__assert_match_open_for_participation(p_match_id);

  v_is_privileged := (
    public.has_role_in_org(
      v_match.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(v_match.season_id, ARRAY['tournament_admin']::text[])
    OR public.is_confirmed_match_referee_or_scorekeeper(p_match_id)
  );

  IF NOT v_is_privileged THEN
    RAISE EXCEPTION 'Not authorized to validate match roster for match %', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_ids IS NULL THEN
    p_season_team_player_ids := ARRAY[]::uuid[];
  END IF;

  FOREACH v_player_id IN ARRAY p_season_team_player_ids LOOP
    SELECT stp.season_team_id INTO v_player_team
    FROM public.season_team_players stp
    WHERE stp.id = v_player_id
      AND stp.organization_id = v_match.organization_id;

    IF v_player_team IS NULL THEN
      RAISE EXCEPTION 'season_team_player % is not on this match roster', v_player_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_player_team NOT IN (v_match.home_season_team_id, v_match.away_season_team_id) THEN
      RAISE EXCEPTION 'season_team_player % does not belong to either team in this match', v_player_id
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  IF array_length(p_season_team_player_ids, 1) IS NOT NULL THEN
    INSERT INTO public.match_participants (
      match_id,
      season_team_player_id,
      organization_id,
      status
    )
    SELECT
      p_match_id,
      stp.id,
      v_match.organization_id,
      'played'
    FROM unnest(p_season_team_player_ids) AS pid(id)
    JOIN public.season_team_players stp ON stp.id = pid.id
    ON CONFLICT (match_id, season_team_player_id) DO UPDATE
    SET status = 'played', updated_at = now();

    GET DIAGNOSTICS v_played_count = ROW_COUNT;
  END IF;

  UPDATE public.match_participants mp
  SET status = 'no_show', updated_at = now()
  WHERE mp.match_id = p_match_id
    AND mp.status IN ('called', 'confirmed')
    AND (
      array_length(p_season_team_player_ids, 1) IS NULL
      OR mp.season_team_player_id <> ALL (p_season_team_player_ids)
    );

  GET DIAGNOSTICS v_no_show_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'played_count', v_played_count,
    'no_show_count', v_no_show_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_match_roster(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_match_roster(uuid, uuid[])
  TO authenticated;
