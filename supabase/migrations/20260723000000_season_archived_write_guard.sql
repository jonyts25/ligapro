-- Migration 028: block writes on archived seasons (__assert_season_not_archived)
-- Read paths unchanged. update_season_with_rules allows archive/reactivate only.

-- ---------------------------------------------------------------------------
-- Core helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__assert_season_not_archived(p_season_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visibility text;
BEGIN
  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.visibility INTO v_visibility
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_visibility IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_visibility = 'archived' THEN
    RAISE EXCEPTION 'Esta temporada está archivada y no admite cambios'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolver helpers (thin wrappers — same semantics, one message)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Match id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.season_id INTO v_season_id
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(v_season_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_match(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_season_team(
  p_season_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  IF p_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Season team id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.season_id INTO v_season_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(v_season_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_season_team(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_season_team_player(
  p_season_team_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_team_id uuid;
BEGIN
  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.season_team_id INTO v_season_team_id
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Season team player not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_season_team(v_season_team_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_season_team_player(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_suspension(
  p_suspension_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stp uuid;
BEGIN
  IF p_suspension_id IS NULL THEN
    RAISE EXCEPTION 'Suspension id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ds.season_team_player_id INTO v_stp
  FROM public.discipline_suspensions ds
  WHERE ds.id = p_suspension_id;

  IF v_stp IS NULL THEN
    RAISE EXCEPTION 'Suspension not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_season_team_player(v_stp);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_suspension(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_match_event(
  p_event_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'Match event id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT me.match_id INTO v_match_id
  FROM public.match_events me
  WHERE me.id = p_event_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Match event not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_match(v_match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_match_event(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_team_charge(
  p_charge_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_team_id uuid;
BEGIN
  IF p_charge_id IS NULL THEN
    RAISE EXCEPTION 'Charge id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT tc.season_team_id INTO v_season_team_id
  FROM public.team_charges tc
  WHERE tc.id = p_charge_id;

  IF v_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Team charge not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_season_team(v_season_team_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_team_charge(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_team_payment(
  p_payment_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_team_id uuid;
BEGIN
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT tp.season_team_id INTO v_season_team_id
  FROM public.team_payments tp
  WHERE tp.id = p_payment_id;

  IF v_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Team payment not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_season_team(v_season_team_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_team_payment(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_knockout_round(
  p_round_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  IF p_round_id IS NULL THEN
    RAISE EXCEPTION 'Knockout round id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT kr.season_id INTO v_season_id
  FROM public.season_knockout_rounds kr
  WHERE kr.id = p_round_id;

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'Knockout round not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(v_season_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_knockout_round(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__assert_season_not_archived_for_captain_invitation(
  p_token uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_team_id uuid;
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Invitation token is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ci.season_team_id INTO v_season_team_id
  FROM public.captain_invitations ci
  WHERE ci.token = p_token;

  IF v_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Captain invitation not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_season_team(v_season_team_id);
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_not_archived_for_captain_invitation(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Direct-table write paths (no dedicated RPC): finance + officials + roles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_charges_enforce_org_matches_season_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st_org uuid;
  v_season_id uuid;
BEGIN
  SELECT st.organization_id, st.season_id
  INTO v_st_org, v_season_id
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_st_org IS NULL THEN
    RAISE EXCEPTION 'season_team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_st_org THEN
    RAISE EXCEPTION
      'team_charges.organization_id (%) must match season_teams.organization_id (%) for season_team %',
      NEW.organization_id,
      v_st_org,
      NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(v_season_id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.team_payments_enforce_org_matches_season_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st_org uuid;
  v_season_id uuid;
BEGIN
  SELECT st.organization_id, st.season_id
  INTO v_st_org, v_season_id
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_st_org IS NULL THEN
    RAISE EXCEPTION 'season_team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_st_org THEN
    RAISE EXCEPTION
      'team_payments.organization_id (%) must match season_teams.organization_id (%) for season_team %',
      NEW.organization_id,
      v_st_org,
      NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(v_season_id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.season_roles_archived_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  v_season_id := COALESCE(NEW.season_id, OLD.season_id);
  PERFORM public.__assert_season_not_archived(v_season_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS season_roles_archived_write_guard ON public.season_roles;
CREATE TRIGGER season_roles_archived_write_guard
  BEFORE INSERT OR DELETE ON public.season_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.season_roles_archived_write_guard();

CREATE OR REPLACE FUNCTION public.match_officials_archived_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
BEGIN
  v_match_id := COALESCE(NEW.match_id, OLD.match_id);
  PERFORM public.__assert_season_not_archived_for_match(v_match_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS match_officials_archived_write_guard ON public.match_officials;
CREATE TRIGGER match_officials_archived_write_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.match_officials
  FOR EACH ROW
  EXECUTE FUNCTION public.match_officials_archived_write_guard();

-- ---------------------------------------------------------------------------
-- update_season_with_rules: allow archive + reactivate; block other edits while archived
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_season_with_rules(
  p_season_id uuid,
  p_name text,
  p_format_type text,
  p_visibility text,
  p_starts_on date,
  p_ends_on date,
  p_points_win integer,
  p_points_draw integer,
  p_points_loss integer,
  p_allow_draws boolean,
  p_match_duration_minutes integer,
  p_minimum_rest_minutes integer,
  p_yellow_card_limit integer,
  p_suspension_matches integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_current_visibility text;
  v_name text;
  v_rules_count integer;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.visibility
  INTO v_org_id, v_current_visibility
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_visibility = 'archived' AND p_visibility = 'archived' THEN
    RAISE EXCEPTION 'Esta temporada está archivada y no admite cambios'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer INTO v_rules_count
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_rules_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one season_rules row for season'
      USING ERRCODE = 'P0001';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Season name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_format_type IS NULL OR p_format_type NOT IN (
    'round_robin',
    'round_robin_double',
    'groups_knockout',
    'knockout'
  ) THEN
    RAISE EXCEPTION 'Invalid format_type'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN (
    'draft',
    'private',
    'unlisted',
    'public',
    'archived'
  ) THEN
    RAISE EXCEPTION 'Invalid visibility'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_starts_on IS NOT NULL
     AND p_ends_on IS NOT NULL
     AND p_ends_on < p_starts_on THEN
    RAISE EXCEPTION 'ends_on must be on or after starts_on'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_points_win IS NULL
     OR p_points_draw IS NULL
     OR p_points_loss IS NULL
     OR p_allow_draws IS NULL
     OR p_match_duration_minutes IS NULL
     OR p_minimum_rest_minutes IS NULL
     OR p_yellow_card_limit IS NULL
     OR p_suspension_matches IS NULL THEN
    RAISE EXCEPTION 'All season rule values are required'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.seasons
  SET
    name = v_name,
    format_type = p_format_type,
    visibility = p_visibility,
    starts_on = p_starts_on,
    ends_on = p_ends_on
  WHERE id = p_season_id
    AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update season'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_rules
  SET
    points_win = p_points_win,
    points_draw = p_points_draw,
    points_loss = p_points_loss,
    allow_draws = p_allow_draws,
    match_duration_minutes = p_match_duration_minutes,
    minimum_rest_minutes = p_minimum_rest_minutes,
    yellow_card_limit = p_yellow_card_limit,
    suspension_matches = p_suspension_matches
  WHERE season_id = p_season_id
    AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update season_rules'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_season_with_rules(
  uuid, text, text, text, date, date,
  integer, integer, integer, boolean, integer, integer, integer, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_season_with_rules(
  uuid, text, text, text, date, date,
  integer, integer, integer, boolean, integer, integer, integer, integer
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Patched write RPCs
-- ---------------------------------------------------------------------------

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.create_season_round_robin_fixture(
  p_season_id uuid,
  p_mode text,
  p_matches jsonb,
  p_group_id uuid DEFAULT NULL
)
RETURNS SETOF public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_mode text;
  v_team_ids uuid[];
  v_n integer;
  v_expected integer;
  v_elem jsonb;
  v_keys text[];
  v_expected_keys text[] := ARRAY[
    'away_season_team_id',
    'home_season_team_id',
    'leg_number',
    'round_number',
    'sequence_in_round'
  ];
  v_round integer;
  v_leg integer;
  v_seq integer;
  v_home uuid;
  v_away uuid;
  v_pair text;
  v_pair_set text[] := ARRAY[]::text[];
  v_pair_counts jsonb := '{}'::jsonb;
  v_pair_homes jsonb := '{}'::jsonb;
  v_round_teams text[];
  v_round_map jsonb := '{}'::jsonb;
  v_count integer;
  v_key text;
  v_homes text[];
  v_group_season uuid;
  v_group_org uuid;
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_mode := NULLIF(btrim(COALESCE(p_mode, '')), '');
  IF v_mode IS NULL OR v_mode NOT IN ('single', 'double') THEN
    RAISE EXCEPTION 'Mode must be single or double'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RAISE EXCEPTION 'Matches payload must be a JSON array'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  IF p_group_id IS NOT NULL THEN
    SELECT sg.season_id, sg.organization_id
    INTO v_group_season, v_group_org
    FROM public.season_groups sg
    WHERE sg.id = p_group_id;

    IF v_group_season IS NULL THEN
      RAISE EXCEPTION 'Group not found' USING ERRCODE = 'P0001';
    END IF;

    IF v_group_season IS DISTINCT FROM p_season_id OR v_group_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Group does not belong to this season' USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.matches m
    WHERE m.season_id = p_season_id
      AND m.season_group_id = p_group_id
      AND m.knockout_round_id IS NULL;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'Group already has matches; regeneration is not allowed'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM public.matches m
    WHERE m.season_id = p_season_id;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'Season already has matches; regeneration is not allowed'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_group_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(st.id ORDER BY st.created_at, st.id), ARRAY[]::uuid[])
    INTO v_team_ids
    FROM public.season_teams st
    WHERE st.season_id = p_season_id
      AND st.organization_id = v_org
      AND st.season_group_id = p_group_id
      AND st.registration_status IN ('registered', 'confirmed');
  ELSE
    SELECT COALESCE(array_agg(st.id ORDER BY st.created_at, st.id), ARRAY[]::uuid[])
    INTO v_team_ids
    FROM public.season_teams st
    WHERE st.season_id = p_season_id
      AND st.organization_id = v_org
      AND st.registration_status IN ('registered', 'confirmed');
  END IF;

  v_n := COALESCE(array_length(v_team_ids, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'At least two eligible teams are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_expected := CASE
    WHEN v_mode = 'single' THEN v_n * (v_n - 1) / 2
    ELSE v_n * (v_n - 1)
  END;

  IF jsonb_array_length(p_matches) <> v_expected THEN
    RAISE EXCEPTION 'Fixture match count must be % for % teams in % mode',
      v_expected, v_n, v_mode
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each match must be a JSON object'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
    INTO v_keys
    FROM jsonb_object_keys(v_elem) AS k;

    IF v_keys IS DISTINCT FROM v_expected_keys THEN
      RAISE EXCEPTION 'Unexpected or missing match properties'
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_round := (v_elem->>'round_number')::integer;
      v_leg := (v_elem->>'leg_number')::integer;
      v_seq := (v_elem->>'sequence_in_round')::integer;
      v_home := (v_elem->>'home_season_team_id')::uuid;
      v_away := (v_elem->>'away_season_team_id')::uuid;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid match field types'
          USING ERRCODE = 'P0001';
    END;

    IF v_round IS NULL OR v_round <= 0 THEN
      RAISE EXCEPTION 'round_number must be > 0'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_leg IS NULL OR v_leg NOT IN (1, 2) THEN
      RAISE EXCEPTION 'leg_number must be 1 or 2'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_mode = 'single' AND v_leg <> 1 THEN
      RAISE EXCEPTION 'Single mode requires leg_number = 1'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_seq IS NULL OR v_seq <= 0 THEN
      RAISE EXCEPTION 'sequence_in_round must be > 0'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_home IS NULL OR v_away IS NULL THEN
      RAISE EXCEPTION 'home and away season teams are required'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_home = v_away THEN
      RAISE EXCEPTION 'Home and away must be distinct'
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT (v_home = ANY (v_team_ids)) OR NOT (v_away = ANY (v_team_ids)) THEN
      RAISE EXCEPTION 'Season team is not eligible for this season'
        USING ERRCODE = 'P0001';
    END IF;

    v_key := v_round::text;
    v_round_teams := COALESCE(
      (
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_round_map->v_key))
      ),
      ARRAY[]::text[]
    );
    IF v_home::text = ANY (v_round_teams) OR v_away::text = ANY (v_round_teams) THEN
      RAISE EXCEPTION 'A team cannot play twice in the same round'
        USING ERRCODE = 'P0001';
    END IF;
    v_round_teams := v_round_teams || ARRAY[v_home::text, v_away::text];
    v_round_map := jsonb_set(
      v_round_map,
      ARRAY[v_key],
      to_jsonb(v_round_teams),
      true
    );

    IF v_home::text < v_away::text THEN
      v_pair := v_home::text || ':' || v_away::text;
    ELSE
      v_pair := v_away::text || ':' || v_home::text;
    END IF;

    v_count := COALESCE((v_pair_counts->>v_pair)::integer, 0) + 1;
    v_pair_counts := jsonb_set(
      v_pair_counts,
      ARRAY[v_pair],
      to_jsonb(v_count),
      true
    );

    v_homes := COALESCE(
      (
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_pair_homes->v_pair))
      ),
      ARRAY[]::text[]
    );
    v_homes := v_homes || ARRAY[v_home::text];
    v_pair_homes := jsonb_set(
      v_pair_homes,
      ARRAY[v_pair],
      to_jsonb(v_homes),
      true
    );

    IF NOT (v_pair = ANY (v_pair_set)) THEN
      v_pair_set := v_pair_set || ARRAY[v_pair];
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_pair_set, 1), 0) <> (v_n * (v_n - 1) / 2) THEN
    RAISE EXCEPTION 'Fixture must include every unique pair exactly as required'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_pair IN ARRAY v_pair_set
  LOOP
    v_count := COALESCE((v_pair_counts->>v_pair)::integer, 0);
    IF v_mode = 'single' THEN
      IF v_count <> 1 THEN
        RAISE EXCEPTION 'Single mode requires each pair exactly once'
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      IF v_count <> 2 THEN
        RAISE EXCEPTION 'Double mode requires each pair exactly twice'
          USING ERRCODE = 'P0001';
      END IF;
      v_homes := ARRAY(
        SELECT jsonb_array_elements_text(v_pair_homes->v_pair)
      );
      IF array_length(v_homes, 1) <> 2 OR v_homes[1] = v_homes[2] THEN
        RAISE EXCEPTION 'Double mode requires inverted home/away for each pair'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.matches (
    season_id,
    organization_id,
    home_season_team_id,
    away_season_team_id,
    status,
    round_number,
    leg_number,
    sequence_in_round,
    round_label,
    season_group_id
  )
  SELECT
    p_season_id,
    v_org,
    (e->>'home_season_team_id')::uuid,
    (e->>'away_season_team_id')::uuid,
    'scheduled',
    (e->>'round_number')::integer,
    (e->>'leg_number')::integer,
    (e->>'sequence_in_round')::integer,
    CASE
      WHEN p_group_id IS NOT NULL THEN
        'Jornada ' || (e->>'round_number')
      ELSE
        'Jornada ' || (e->>'round_number')
    END,
    p_group_id
  FROM jsonb_array_elements(p_matches) AS e
  ORDER BY (e->>'round_number')::integer, (e->>'sequence_in_round')::integer;

  RETURN QUERY
  SELECT m.*
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND (
      (p_group_id IS NULL AND m.season_group_id IS NULL AND m.knockout_round_id IS NULL)
      OR m.season_group_id = p_group_id
    )
  ORDER BY m.round_number NULLS LAST, m.sequence_in_round NULLS LAST, m.id;
END;
$$;




REVOKE ALL ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb, uuid)
  TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.create_season_knockout_bracket(
  p_season_id uuid,
  p_seed_mode text DEFAULT 'random'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_team_ids uuid[];
  v_n integer;
  v_bracket_size integer;
  v_num_byes integer;
  v_num_slots integer;
  v_bye_teams uuid[];
  v_play_teams uuid[];
  v_slot integer;
  v_bye_idx integer := 1;
  v_play_idx integer := 1;
  v_home uuid;
  v_away uuid;
  v_bye_slots integer[];
  v_slots jsonb := '[]'::jsonb;
  i integer;
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(NULLIF(btrim(p_seed_mode), ''), 'random') <> 'random' THEN
    RAISE EXCEPTION 'Only random seed mode is supported' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'knockout' THEN
    RAISE EXCEPTION 'Season format must be knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  SELECT COALESCE(array_agg(st.id ORDER BY random()), ARRAY[]::uuid[])
  INTO v_team_ids
  FROM public.season_teams st
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
    AND st.registration_status IN ('registered', 'confirmed');

  v_n := COALESCE(array_length(v_team_ids, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'At least two eligible teams are required' USING ERRCODE = 'P0001';
  END IF;

  v_bracket_size := public.__knockout_next_power_of_two(v_n);
  v_num_byes := v_bracket_size - v_n;
  v_num_slots := v_bracket_size / 2;

  v_bye_teams := v_team_ids[1:v_num_byes];
  v_play_teams := v_team_ids[(v_num_byes + 1):v_n];

  v_bye_slots := ARRAY[]::integer[];
  FOR i IN 1..v_num_byes LOOP
    v_bye_slots := v_bye_slots || (
      (i - 1) * v_num_slots / GREATEST(v_num_byes, 1) + 1
    )::integer;
  END LOOP;

  FOR v_slot IN 1..v_num_slots LOOP
    IF v_slot = ANY (v_bye_slots) THEN
      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_bye_teams[v_bye_idx],
          'away_season_team_id', NULL
        )
      );
      v_bye_idx := v_bye_idx + 1;
    ELSE
      v_home := v_play_teams[v_play_idx];
      v_away := v_play_teams[v_play_idx + 1];
      v_play_idx := v_play_idx + 2;

      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_home,
          'away_season_team_id', v_away
        )
      );
    END IF;
  END LOOP;

  RETURN public.__create_knockout_bracket_from_slots(
    p_season_id,
    v_slots,
    true
  );
END;
$$;




REVOKE ALL ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb, uuid)
  TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.generate_knockout_from_groups(p_season_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_advance integer;
  v_group_count integer;
  v_group record;
  v_standings record;
  v_advancing jsonb := '[]'::jsonb;
  v_team_count integer;
  v_bracket_size integer;
  v_num_byes integer;
  v_num_slots integer;
  v_pairings jsonb := '[]'::jsonb;
  v_slots jsonb := '[]'::jsonb;
  v_bye_teams uuid[] := ARRAY[]::uuid[];
  v_play_home uuid[] := ARRAY[]::uuid[];
  v_play_away uuid[] := ARRAY[]::uuid[];
  v_play_count integer;
  v_bye_slots integer[];
  v_slot integer;
  v_bye_idx integer := 1;
  v_play_idx integer := 1;
  v_i integer;
  v_j integer;
  v_g integer;
  v_k integer;
  v_home uuid;
  v_away uuid;
  v_team uuid;
  v_group_id uuid;
  v_pos integer;
  v_used uuid[] := ARRAY[]::uuid[];
  v_candidates uuid[];
  v_cross_ok boolean := false;
  v_pair jsonb;
  v_elem jsonb;
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'groups_knockout' THEN
    RAISE EXCEPTION 'Season format must be groups_knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  SELECT sr.groups_advance_per_group INTO v_advance
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_advance IS NULL OR v_advance <= 0 THEN
    RAISE EXCEPTION 'Configure groups_advance_per_group on season_rules first'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_group_count
  FROM public.season_groups sg
  WHERE sg.season_id = p_season_id;

  IF v_group_count < 1 THEN
    RAISE EXCEPTION 'Season has no groups configured' USING ERRCODE = 'P0001';
  END IF;

  FOR v_group IN
    SELECT sg.id, sg.name
    FROM public.season_groups sg
    WHERE sg.season_id = p_season_id
    ORDER BY sg.name ASC, sg.id ASC
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.season_group_id = v_group.id
        AND m.knockout_round_id IS NULL
        AND (
          m.status NOT IN ('finished', 'walkover')
          OR m.home_score IS NULL
          OR m.away_score IS NULL
        )
    ) THEN
      RAISE EXCEPTION
        'Group % has matches without final results; complete the group fixture first',
        v_group.name
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.season_teams st
      WHERE st.season_group_id = v_group.id
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.season_group_id = v_group.id
        AND m.knockout_round_id IS NULL
        AND m.status IN ('finished', 'walkover')
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        'Group % has no completed match results; cannot determine standings',
        v_group.name
        USING ERRCODE = 'P0001';
    END IF;

    FOR v_pos IN 1..v_advance LOOP
      SELECT c.season_team_id, c."position"
      INTO v_standings
      FROM public.__season_standings_core(p_season_id, v_group.id) c
      WHERE c."position" = v_pos
      ORDER BY c.team_name ASC, c.season_team_id ASC
      LIMIT 1;

      IF v_standings.season_team_id IS NULL THEN
        RAISE EXCEPTION
          'Group % does not have % distinct ranked teams to advance',
          v_group.name, v_advance
          USING ERRCODE = 'P0001';
      END IF;

      v_advancing := v_advancing || jsonb_build_array(
        jsonb_build_object(
          'season_team_id', v_standings.season_team_id,
          'group_id', v_group.id,
          'group_name', v_group.name,
          'position', v_pos
        )
      );
    END LOOP;
  END LOOP;

  v_team_count := jsonb_array_length(v_advancing);
  IF v_team_count < 2 THEN
    RAISE EXCEPTION 'At least two advancing teams are required for knockout'
      USING ERRCODE = 'P0001';
  END IF;

  v_g := v_group_count;
  v_k := v_advance;

  -- Cross pairing: G=2 any K, or K=1 with even G
  IF v_g = 2 THEN
    v_cross_ok := true;
    FOR v_i IN 0..0 LOOP
      FOR v_pos IN 1..v_k LOOP
        SELECT (e ->> 'season_team_id')::uuid INTO v_home
        FROM jsonb_array_elements(v_advancing) e
        WHERE (e ->> 'group_id')::uuid = (
          SELECT sg.id FROM public.season_groups sg
          WHERE sg.season_id = p_season_id
          ORDER BY sg.name ASC, sg.id ASC
          LIMIT 1 OFFSET 0
        )
          AND (e ->> 'position')::integer = v_pos;

        SELECT (e ->> 'season_team_id')::uuid INTO v_away
        FROM jsonb_array_elements(v_advancing) e
        WHERE (e ->> 'group_id')::uuid = (
          SELECT sg.id FROM public.season_groups sg
          WHERE sg.season_id = p_season_id
          ORDER BY sg.name ASC, sg.id ASC
          LIMIT 1 OFFSET 1
        )
          AND (e ->> 'position')::integer = (v_k + 1 - v_pos);

        IF v_home IS NULL OR v_away IS NULL OR v_home = v_away THEN
          v_cross_ok := false;
          EXIT;
        END IF;

        v_pairings := v_pairings || jsonb_build_array(
          jsonb_build_object('home', v_home, 'away', v_away)
        );
        v_used := v_used || v_home || v_away;
      END LOOP;
    END LOOP;
  ELSIF v_k = 1 AND v_g >= 2 AND v_g % 2 = 0 THEN
    v_cross_ok := true;
    FOR v_i IN 0..(v_g / 2 - 1) LOOP
      SELECT (e ->> 'season_team_id')::uuid INTO v_home
      FROM jsonb_array_elements(v_advancing) e
      WHERE (e ->> 'group_id')::uuid = (
        SELECT sg.id FROM public.season_groups sg
        WHERE sg.season_id = p_season_id
        ORDER BY sg.name ASC, sg.id ASC
        LIMIT 1 OFFSET v_i
      )
        AND (e ->> 'position')::integer = 1;

      SELECT (e ->> 'season_team_id')::uuid INTO v_away
      FROM jsonb_array_elements(v_advancing) e
      WHERE (e ->> 'group_id')::uuid = (
        SELECT sg.id FROM public.season_groups sg
        WHERE sg.season_id = p_season_id
        ORDER BY sg.name ASC, sg.id ASC
        LIMIT 1 OFFSET (v_i + v_g / 2)
      )
        AND (e ->> 'position')::integer = 1;

      IF v_home IS NULL OR v_away IS NULL OR v_home = v_away THEN
        v_cross_ok := false;
        EXIT;
      END IF;

      v_pairings := v_pairings || jsonb_build_array(
        jsonb_build_object('home', v_home, 'away', v_away)
      );
      v_used := v_used || v_home || v_away;
    END LOOP;
  END IF;

  IF NOT v_cross_ok OR jsonb_array_length(v_pairings) * 2 <> v_team_count THEN
    v_pairings := '[]'::jsonb;
    v_used := ARRAY[]::uuid[];

    FOR v_elem IN
      SELECT value
      FROM jsonb_array_elements(v_advancing)
      ORDER BY random()
    LOOP
      v_team := (v_elem ->> 'season_team_id')::uuid;
      v_group_id := (v_elem ->> 'group_id')::uuid;

      IF v_team = ANY (v_used) THEN
        CONTINUE;
      END IF;

      v_candidates := ARRAY[]::uuid[];
      FOR v_j IN
        SELECT (e ->> 'season_team_id')::uuid
        FROM jsonb_array_elements(v_advancing) e
        WHERE NOT ((e ->> 'season_team_id')::uuid = ANY (v_used))
          AND (e ->> 'season_team_id')::uuid <> v_team
          AND (e ->> 'group_id')::uuid IS DISTINCT FROM v_group_id
      LOOP
        v_candidates := v_candidates || v_j;
      END LOOP;

      IF COALESCE(array_length(v_candidates, 1), 0) = 0 THEN
        FOR v_j IN
          SELECT (e ->> 'season_team_id')::uuid
          FROM jsonb_array_elements(v_advancing) e
          WHERE NOT ((e ->> 'season_team_id')::uuid = ANY (v_used))
            AND (e ->> 'season_team_id')::uuid <> v_team
        LOOP
          v_candidates := v_candidates || v_j;
        END LOOP;
      END IF;

      IF COALESCE(array_length(v_candidates, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Unable to pair advancing teams' USING ERRCODE = 'P0001';
      END IF;

      v_away := v_candidates[1 + floor(random() * array_length(v_candidates, 1))::integer];
      v_pairings := v_pairings || jsonb_build_array(
        jsonb_build_object('home', v_team, 'away', v_away)
      );
      v_used := v_used || v_team || v_away;
    END LOOP;
  END IF;

  v_bracket_size := public.__knockout_next_power_of_two(v_team_count);
  v_num_byes := v_bracket_size - v_team_count;
  v_num_slots := v_bracket_size / 2;
  v_play_count := jsonb_array_length(v_pairings);

  FOR v_i IN 1..v_play_count LOOP
    v_play_home := v_play_home || (v_pairings -> (v_i - 1) ->> 'home')::uuid;
    v_play_away := v_play_away || (v_pairings -> (v_i - 1) ->> 'away')::uuid;
  END LOOP;

  FOR v_j IN
    SELECT (e ->> 'season_team_id')::uuid
    FROM jsonb_array_elements(v_advancing) e
    WHERE NOT ((e ->> 'season_team_id')::uuid = ANY (v_used))
  LOOP
    v_bye_teams := v_bye_teams || v_j;
  END LOOP;

  IF COALESCE(array_length(v_bye_teams, 1), 0) <> v_num_byes THEN
    RAISE EXCEPTION 'Internal bracket bye count mismatch' USING ERRCODE = 'P0001';
  END IF;

  v_bye_slots := ARRAY[]::integer[];
  FOR v_i IN 1..v_num_byes LOOP
    v_bye_slots := v_bye_slots || (
      (v_i - 1) * v_num_slots / GREATEST(v_num_byes, 1) + 1
    )::integer;
  END LOOP;

  FOR v_slot IN 1..v_num_slots LOOP
    IF v_slot = ANY (v_bye_slots) THEN
      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_bye_teams[v_bye_idx],
          'away_season_team_id', NULL
        )
      );
      v_bye_idx := v_bye_idx + 1;
    ELSE
      v_home := v_play_home[v_play_idx];
      v_away := v_play_away[v_play_idx];
      v_play_idx := v_play_idx + 1;

      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_home,
          'away_season_team_id', v_away
        )
      );
    END IF;
  END LOOP;

  RETURN public.__create_knockout_bracket_from_slots(
    p_season_id,
    v_slots,
    false
  );
END;
$$;




REVOKE ALL ON FUNCTION public.generate_knockout_from_groups(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_knockout_from_groups(uuid) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.schedule_match(
  p_match_id uuid,
  p_field_id uuid,
  p_starts_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id INTO v_org
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__schedule_match_core(
    p_match_id,
    p_field_id,
    p_starts_at,
    'programado'
  );
END;
$$;




REVOKE ALL ON FUNCTION public.confirm_match_calendar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_match_calendar(uuid) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.unschedule_match(
  p_match_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_status text;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Match id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.status
  INTO v_org, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('in_progress', 'finished') THEN
    RAISE EXCEPTION 'Cannot unschedule a match that has started or finished'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.matches
  SET field_reservation_id = NULL
  WHERE id = p_match_id
    AND organization_id = v_org;

  UPDATE public.field_reservations
  SET status = 'cancelled'
  WHERE match_id = p_match_id
    AND organization_id = v_org
    AND reservation_type = 'match'
    AND status = 'confirmed';
END;
$$;




REVOKE ALL ON FUNCTION public.unschedule_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unschedule_match(uuid) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.confirm_match_calendar(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_res uuid;
  v_match_status text;
  v_field_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_conflict integer;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Match id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.field_reservation_id, m.status
  INTO v_org, v_res, v_match_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_match_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled matches can be calendar-confirmed'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_res IS NULL THEN
    RAISE EXCEPTION 'Match has no field reservation to confirm'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT fr.field_id, fr.starts_at, fr.ends_at
  INTO v_field_id, v_starts_at, v_ends_at
  FROM public.field_reservations fr
  WHERE fr.id = v_res
    AND fr.organization_id = v_org
    AND fr.status = 'confirmed';

  IF v_field_id IS NULL THEN
    RAISE EXCEPTION 'Confirmed reservation not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_conflict
  FROM public.field_reservations fr
  WHERE fr.field_id = v_field_id
    AND fr.status = 'confirmed'
    AND fr.id IS DISTINCT FROM v_res
    AND tstzrange(fr.starts_at, fr.ends_at, '[)') &&
        tstzrange(v_starts_at, v_ends_at, '[)');

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Field reservation conflicts with another confirmed slot'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.matches
  SET calendar_status = 'confirmado'
  WHERE id = p_match_id
    AND organization_id = v_org;
END;
$$;




REVOKE ALL ON FUNCTION public.confirm_match_calendar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_match_calendar(uuid) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.apply_recurring_slot_to_season(
  p_season_id uuid,
  p_day_of_week integer,
  p_start_time time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_field_id uuid;
  v_match record;
  v_starts_at timestamptz;
  v_scheduled integer := 0;
  v_skipped integer := 0;
  v_failed jsonb := '[]'::jsonb;
  v_match_count integer;
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL OR p_day_of_week IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Season, day_of_week and start_time are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_day_of_week NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'day_of_week must be between 0 and 6'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  SELECT COUNT(*) INTO v_match_count
  FROM public.matches m
  WHERE m.season_id = p_season_id;

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'Season has no fixture matches'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT sr.recurring_slot_field_id INTO v_field_id
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_field_id IS NULL THEN
    RAISE EXCEPTION 'Configure recurring_slot_field_id on season_rules before applying recurring slot'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_rules
  SET
    recurring_slot_day_of_week = p_day_of_week,
    recurring_slot_start_time = p_start_time
  WHERE season_id = p_season_id
    AND organization_id = v_org;

  FOR v_match IN
    SELECT m.id, m.round_number, m.field_reservation_id
    FROM public.matches m
    WHERE m.season_id = p_season_id
      AND m.field_reservation_id IS NULL
      AND m.round_number IS NOT NULL
    ORDER BY m.round_number, m.sequence_in_round NULLS LAST, m.id
  LOOP
    BEGIN
      v_starts_at := public.__round_slot_starts_at(
        p_season_id,
        v_match.round_number,
        p_day_of_week,
        p_start_time
      );

      PERFORM public.__schedule_match_core(
        v_match.id,
        v_field_id,
        v_starts_at,
        'programado'
      );

      v_scheduled := v_scheduled + 1;
    EXCEPTION
      WHEN others THEN
        v_failed := v_failed || jsonb_build_object(
          'match_id', v_match.id,
          'error', SQLERRM
        );
    END;
  END LOOP;

  SELECT COUNT(*) INTO v_skipped
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND m.field_reservation_id IS NOT NULL;

  RETURN jsonb_build_object(
    'scheduled', v_scheduled,
    'skipped_already_scheduled', v_skipped,
    'failed', v_failed
  );
END;
$$;




REVOKE ALL ON FUNCTION public.set_season_field_blocks(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_field_blocks(uuid, jsonb) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.set_season_field_blocks(
  p_season_id uuid,
  p_blocks jsonb
)
RETURNS SETOF public.season_field_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_elem jsonb;
  v_idx integer := 0;
  v_i integer;
  v_j integer;
  v_len integer;
  v_field_id uuid;
  v_day integer;
  v_starts time;
  v_ends time;
  v_fields uuid[];
  v_days integer[];
  v_starts_arr time[];
  v_ends_arr time[];
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_blocks IS NULL OR jsonb_typeof(p_blocks) <> 'array' THEN
    RAISE EXCEPTION 'Blocks must be a JSON array'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_len := jsonb_array_length(p_blocks);

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_blocks)
  LOOP
    v_idx := v_idx + 1;

    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each block must be a JSON object'
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_field_id := (v_elem ->> 'field_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid field_id in block %', v_idx
        USING ERRCODE = 'P0001';
    END;

    IF v_field_id IS NULL THEN
      RAISE EXCEPTION 'field_id is required in block %', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.fields f
      WHERE f.id = v_field_id
        AND f.organization_id = v_org
    ) THEN
      RAISE EXCEPTION 'Field % does not belong to this organization', v_field_id
        USING ERRCODE = 'P0001';
    END IF;

    v_day := (v_elem ->> 'day_of_week')::integer;
    IF v_day IS NULL OR v_day < 0 OR v_day > 6 THEN
      RAISE EXCEPTION 'day_of_week must be between 0 and 6 in block %', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_starts := (v_elem ->> 'starts_at')::time;
      v_ends := (v_elem ->> 'ends_at')::time;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid time format in block %', v_idx
        USING ERRCODE = 'P0001';
    END;

    IF v_ends <= v_starts THEN
      RAISE EXCEPTION 'ends_at must be after starts_at in block %', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    v_fields := array_append(v_fields, v_field_id);
    v_days := array_append(v_days, v_day);
    v_starts_arr := array_append(v_starts_arr, v_starts);
    v_ends_arr := array_append(v_ends_arr, v_ends);
  END LOOP;

  IF v_len > 1 THEN
    FOR v_i IN 1 .. v_len LOOP
      FOR v_j IN (v_i + 1) .. v_len LOOP
        IF v_fields[v_i] = v_fields[v_j]
           AND v_days[v_i] = v_days[v_j]
           AND tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_i]),
                 ('2000-01-01'::date + v_ends_arr[v_i])
               )
             && tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_j]),
                 ('2000-01-01'::date + v_ends_arr[v_j])
               )
        THEN
          RAISE EXCEPTION 'Overlapping blocks in payload for the same field and day'
            USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  DELETE FROM public.season_field_blocks
  WHERE season_id = p_season_id
    AND organization_id = v_org;

  IF v_len > 0 THEN
    FOR v_i IN 1 .. v_len LOOP
      INSERT INTO public.season_field_blocks (
        organization_id,
        season_id,
        field_id,
        day_of_week,
        starts_at,
        ends_at
      ) VALUES (
        v_org,
        p_season_id,
        v_fields[v_i],
        v_days[v_i],
        v_starts_arr[v_i],
        v_ends_arr[v_i]
      );
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT b.*
  FROM public.season_field_blocks b
  WHERE b.season_id = p_season_id
  ORDER BY b.field_id, b.day_of_week, b.starts_at;
END;
$$;




REVOKE ALL ON FUNCTION public.set_season_field_blocks(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_field_blocks(uuid, jsonb) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.set_season_groups(
  p_season_id uuid,
  p_group_names jsonb
)
RETURNS SETOF public.season_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_name text;
  v_names text[] := ARRAY[]::text[];
  v_seen text[] := ARRAY[]::text[];
  v_elem jsonb;
  v_idx integer := 0;
  v_group record;
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_group_names IS NULL OR jsonb_typeof(p_group_names) <> 'array' THEN
    RAISE EXCEPTION 'Group names must be a JSON array' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'groups_knockout' THEN
    RAISE EXCEPTION 'Season format must be groups_knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_group_names)
  LOOP
    v_idx := v_idx + 1;

    IF jsonb_typeof(v_elem) <> 'string' THEN
      RAISE EXCEPTION 'Each group name must be a JSON string (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    v_name := NULLIF(btrim(v_elem #>> '{}'), '');

    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Group name cannot be empty (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF v_name = ANY (v_seen) THEN
      RAISE EXCEPTION 'Duplicate group name in payload: %', v_name
        USING ERRCODE = 'P0001';
    END IF;

    v_seen := v_seen || v_name;
    v_names := v_names || v_name;
  END LOOP;

  FOR v_group IN
    SELECT sg.id, sg.name
    FROM public.season_groups sg
    WHERE sg.season_id = p_season_id
      AND sg.organization_id = v_org
      AND NOT (sg.name = ANY (v_names))
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.season_group_id = v_group.id
    ) THEN
      RAISE EXCEPTION
        'Cannot remove group % while it has matches; delete group fixtures first',
        v_group.name
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  UPDATE public.season_teams st
  SET season_group_id = NULL
  FROM public.season_groups sg
  WHERE st.season_group_id = sg.id
    AND sg.season_id = p_season_id
    AND sg.organization_id = v_org
    AND NOT (sg.name = ANY (v_names));

  DELETE FROM public.season_groups sg
  WHERE sg.season_id = p_season_id
    AND sg.organization_id = v_org
    AND NOT (sg.name = ANY (v_names));

  IF COALESCE(array_length(v_names, 1), 0) > 0 THEN
    INSERT INTO public.season_groups (organization_id, season_id, name)
    SELECT v_org, p_season_id, n
    FROM unnest(v_names) AS n
    ON CONFLICT (season_id, name) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT g.*
  FROM public.season_groups g
  WHERE g.season_id = p_season_id
    AND g.organization_id = v_org
  ORDER BY g.name ASC, g.id ASC;
END;
$$;




REVOKE ALL ON FUNCTION public.set_season_groups(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_groups(uuid, jsonb) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.assign_teams_to_groups(
  p_season_id uuid,
  p_assignments jsonb
)
RETURNS SETOF public.season_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_elem jsonb;
  v_idx integer := 0;
  v_season_team_id uuid;
  v_group_id uuid;
  v_st_season uuid;
  v_st_org uuid;
  v_group_season uuid;
  v_group_org uuid;
  v_team_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' THEN
    RAISE EXCEPTION 'Assignments must be a JSON array' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'groups_knockout' THEN
    RAISE EXCEPTION 'Season format must be groups_knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_assignments)
  LOOP
    v_idx := v_idx + 1;

    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each assignment must be a JSON object (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_season_team_id := (v_elem ->> 'season_team_id')::uuid;
      v_group_id := (v_elem ->> 'group_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid UUID in assignment %', v_idx USING ERRCODE = 'P0001';
    END;

    IF v_season_team_id IS NULL OR v_group_id IS NULL THEN
      RAISE EXCEPTION 'season_team_id and group_id are required (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF v_season_team_id = ANY (v_team_ids) THEN
      RAISE EXCEPTION 'Duplicate season_team_id in payload: %', v_season_team_id
        USING ERRCODE = 'P0001';
    END IF;
    v_team_ids := v_team_ids || v_season_team_id;

    SELECT st.season_id, st.organization_id
    INTO v_st_season, v_st_org
    FROM public.season_teams st
    WHERE st.id = v_season_team_id;

    IF v_st_season IS NULL THEN
      RAISE EXCEPTION 'Season team % not found', v_season_team_id USING ERRCODE = 'P0001';
    END IF;

    IF v_st_season IS DISTINCT FROM p_season_id OR v_st_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Season team % does not belong to this season/organization', v_season_team_id
        USING ERRCODE = 'P0001';
    END IF;

    SELECT sg.season_id, sg.organization_id
    INTO v_group_season, v_group_org
    FROM public.season_groups sg
    WHERE sg.id = v_group_id;

    IF v_group_season IS NULL THEN
      RAISE EXCEPTION 'Group % not found', v_group_id USING ERRCODE = 'P0001';
    END IF;

    IF v_group_season IS DISTINCT FROM p_season_id OR v_group_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Group % does not belong to this season/organization', v_group_id
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  UPDATE public.season_teams st
  SET season_group_id = NULL
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
    AND st.id = ANY (v_team_ids);

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_assignments)
  LOOP
    v_season_team_id := (v_elem ->> 'season_team_id')::uuid;
    v_group_id := (v_elem ->> 'group_id')::uuid;

    UPDATE public.season_teams st
    SET season_group_id = v_group_id
    WHERE st.id = v_season_team_id;
  END LOOP;

  RETURN QUERY
  SELECT st.*
  FROM public.season_teams st
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
  ORDER BY st.created_at ASC, st.id ASC;
END;
$$;




REVOKE ALL ON FUNCTION public.assign_teams_to_groups(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_teams_to_groups(uuid, jsonb) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.propose_match_reschedule(
  p_match_id uuid,
  p_proposed_starts_at timestamptz,
  p_proposed_field_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_home uuid;
  v_away uuid;
  v_captain_team uuid;
  v_ttl_hours integer;
  v_request_id uuid;
  v_field_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.expire_stale_match_reschedule_requests();

  SELECT m.organization_id, m.home_season_team_id, m.away_season_team_id
  INTO v_org, v_home, v_away
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_of_match(p_match_id, v_uid) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_captain_team := public.__captain_season_team_for_match(p_match_id, v_uid);

  IF p_proposed_starts_at IS NULL THEN
    RAISE EXCEPTION 'Proposed starts_at is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_field_id := p_proposed_field_id;
  IF v_field_id IS NULL THEN
    SELECT fr.field_id INTO v_field_id
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.id = p_match_id;
  END IF;

  SELECT sr.reschedule_request_ttl_hours INTO v_ttl_hours
  FROM public.matches m
  JOIN public.season_rules sr ON sr.season_id = m.season_id
  WHERE m.id = p_match_id;

  INSERT INTO public.match_reschedule_requests (
    organization_id,
    match_id,
    proposed_by_profile_id,
    proposed_starts_at,
    proposed_field_id,
    status,
    expires_at
  ) VALUES (
    v_org,
    p_match_id,
    v_uid,
    p_proposed_starts_at,
    v_field_id,
    'proposed',
    now() + make_interval(hours => COALESCE(v_ttl_hours, 72))
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;




REVOKE ALL ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_match_reschedule(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_match_reschedule(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.respond_match_reschedule(
  p_request_id uuid,
  p_approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_req public.match_reschedule_requests;
  v_home uuid;
  v_away uuid;
  v_proposer_team uuid;
  v_responder_team uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.expire_stale_match_reschedule_requests();

  SELECT * INTO v_req
  FROM public.match_reschedule_requests mrr
  WHERE mrr.id = p_request_id;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.status <> 'proposed' THEN
    RAISE EXCEPTION 'Request is not awaiting opponent response'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.expires_at < now() THEN
    UPDATE public.match_reschedule_requests
    SET status = 'expired'
    WHERE id = v_req.id;
    RAISE EXCEPTION 'Request has expired'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.proposed_by_profile_id = v_uid THEN
    RAISE EXCEPTION 'Proposer cannot respond to own request'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_of_match(v_req.match_id, v_uid) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.home_season_team_id, m.away_season_team_id
  INTO v_home, v_away
  FROM public.matches m
  WHERE m.id = v_req.match_id;

  v_proposer_team := public.__captain_season_team_for_match(v_req.match_id, v_req.proposed_by_profile_id);
  v_responder_team := public.__captain_season_team_for_match(v_req.match_id, v_uid);

  IF v_proposer_team IS NULL OR v_responder_team IS NULL THEN
    RAISE EXCEPTION 'Captain teams could not be resolved'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_proposer_team = v_responder_team THEN
    RAISE EXCEPTION 'Opponent captain must respond'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.match_reschedule_requests
  SET
    status = CASE
      WHEN p_approve THEN 'approved_by_opponent'
      ELSE 'rejected_by_opponent'
    END,
    responded_by_profile_id = v_uid,
    responded_at = now()
  WHERE id = v_req.id;
END;
$$;




REVOKE ALL ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_match_reschedule(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_match_reschedule(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.resolve_match_reschedule(
  p_request_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_req public.match_reschedule_requests;
  v_field_id uuid;
  v_notes text;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.expire_stale_match_reschedule_requests();

  SELECT * INTO v_req
  FROM public.match_reschedule_requests mrr
  WHERE mrr.id = p_request_id;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_req.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.status <> 'approved_by_opponent' THEN
    RAISE EXCEPTION 'Request must be approved by opponent before admin resolution'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  IF p_action = 'no_availability' THEN
    UPDATE public.match_reschedule_requests
    SET
      status = 'no_availability',
      admin_resolved_by_profile_id = v_uid,
      admin_resolution_notes = v_notes
    WHERE id = v_req.id;
    RETURN;
  END IF;

  IF p_action <> 'confirm' THEN
    RAISE EXCEPTION 'Action must be confirm or no_availability'
      USING ERRCODE = 'P0001';
  END IF;

  v_field_id := v_req.proposed_field_id;
  IF v_field_id IS NULL THEN
    SELECT fr.field_id INTO v_field_id
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.id = v_req.match_id;
  END IF;

  IF v_field_id IS NULL THEN
    RAISE EXCEPTION 'Proposed field is required to confirm reschedule'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__schedule_match_core(
    v_req.match_id,
    v_field_id,
    v_req.proposed_starts_at,
    'confirmado'
  );

  UPDATE public.match_reschedule_requests
  SET
    status = 'confirmed_by_admin',
    admin_resolved_by_profile_id = v_uid,
    admin_resolution_notes = v_notes
  WHERE id = v_req.id;
END;
$$;




REVOKE ALL ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_match_reschedule(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_match_reschedule(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.record_match_event(
  p_match_id uuid,
  p_season_team_player_id uuid,
  p_event_type text,
  p_minute integer,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_status text;
  v_home uuid;
  v_away uuid;
  v_player_st uuid;
  v_player_status text;
  v_event_type text;
  v_notes text;
  v_event_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NULL OR p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Match id and season_team_player_id are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_minute IS NULL OR p_minute < 0 OR p_minute > 130 THEN
    RAISE EXCEPTION 'minute must be between 0 and 130'
      USING ERRCODE = 'P0001';
  END IF;

  v_event_type := NULLIF(btrim(COALESCE(p_event_type, '')), '');
  IF v_event_type IS NULL OR v_event_type NOT IN (
    'goal',
    'own_goal',
    'yellow_card',
    'red_card',
    'substitution_in',
    'substitution_out',
    'injury'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  SELECT
    m.organization_id,
    m.status,
    m.home_season_team_id,
    m.away_season_team_id
  INTO v_org, v_status, v_home, v_away
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.can_capture_match(p_match_id) THEN
    RAISE EXCEPTION 'Not authorized to capture match %', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('finished', 'cancelled', 'walkover') THEN
    RAISE EXCEPTION 'Cannot record events on a closed match (%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_match_capture_window(p_match_id);

  SELECT stp.season_team_id, stp.registration_status
  INTO v_player_st, v_player_status
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id
    AND stp.organization_id = v_org;

  IF v_player_st IS NULL THEN
    RAISE EXCEPTION 'season_team_player not found in this organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_player_status = 'inactive' THEN
    RAISE EXCEPTION 'Cannot record events for an inactive player'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_player_st IS DISTINCT FROM v_home AND v_player_st IS DISTINCT FROM v_away THEN
    RAISE EXCEPTION 'Player does not belong to either team in this match'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.match_events (
    match_id,
    organization_id,
    season_team_player_id,
    event_type,
    minute,
    notes
  ) VALUES (
    p_match_id,
    v_org,
    p_season_team_player_id,
    v_event_type,
    p_minute,
    v_notes
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;




REVOKE ALL ON FUNCTION public.void_match_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_match_event(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.update_match_result(
  p_match_id uuid,
  p_status text,
  p_home_score integer,
  p_away_score integer
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_match public.matches;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role_in_org(
      v_match.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(v_match.season_id, ARRAY['tournament_admin']::text[])
  ) THEN
    RAISE EXCEPTION
      'Not authorized to update match result for match %',
      p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_match_capture_window(p_match_id);

  UPDATE public.matches
  SET
    status = p_status,
    home_score = p_home_score,
    away_score = p_away_score,
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;




REVOKE ALL ON FUNCTION public.void_match_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_match_event(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.void_match_event(
  p_event_id uuid,
  p_reason text
)
RETURNS public.match_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_row public.match_events;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  PERFORM public.__assert_season_not_archived_for_match_event(p_event_id);
  SELECT * INTO v_row
  FROM public.match_events
  WHERE id = p_event_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'match_event % does not exist', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to void match_event %', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'match_event % is already voided', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.match_event_void', 'true', true);

  UPDATE public.match_events
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason,
    updated_at = now()
  WHERE id = p_event_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;




REVOKE ALL ON FUNCTION public.void_match_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_match_event(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.waive_discipline_suspension(
  p_suspension_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_reason text;
BEGIN
  PERFORM public.__assert_season_not_archived_for_suspension(p_suspension_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ds.organization_id INTO v_org
  FROM public.discipline_suspensions ds
  WHERE ds.id = p_suspension_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Suspension not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.discipline_suspensions
  SET
    status = 'waived',
    notes = v_reason
  WHERE id = p_suspension_id
    AND organization_id = v_org;
END;
$$;




REVOKE ALL ON FUNCTION public.waive_discipline_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_discipline_suspension_length(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_administrative_suspension(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waive_discipline_suspension(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.adjust_discipline_suspension_length(
  p_suspension_id uuid,
  p_matches_remaining integer,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_reason text;
BEGIN
  PERFORM public.__assert_season_not_archived_for_suspension(p_suspension_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_matches_remaining IS NULL OR p_matches_remaining < 0 THEN
    RAISE EXCEPTION 'matches_remaining must be >= 0'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ds.organization_id INTO v_org
  FROM public.discipline_suspensions ds
  WHERE ds.id = p_suspension_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Suspension not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.discipline_suspensions
  SET
    matches_remaining = p_matches_remaining,
    notes = v_reason
  WHERE id = p_suspension_id
    AND organization_id = v_org;
END;
$$;




REVOKE ALL ON FUNCTION public.waive_discipline_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_discipline_suspension_length(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_administrative_suspension(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waive_discipline_suspension(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.create_administrative_suspension(
  p_season_team_player_id uuid,
  p_suspension_type text,
  p_matches_remaining integer,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_type text;
  v_reason text;
  v_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team_player(p_season_team_player_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_type := NULLIF(btrim(COALESCE(p_suspension_type, '')), '');
  IF v_type IS NULL OR v_type NOT IN ('administrative', 'expulsion') THEN
    RAISE EXCEPTION 'suspension_type must be administrative or expulsion'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_matches_remaining IS NULL OR p_matches_remaining < 0 THEN
    RAISE EXCEPTION 'matches_remaining must be >= 0'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id INTO v_org
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.discipline_suspensions (
    organization_id,
    season_team_player_id,
    source_match_event_id,
    suspension_type,
    matches_remaining,
    status,
    notes
  ) VALUES (
    v_org,
    p_season_team_player_id,
    NULL,
    v_type,
    p_matches_remaining,
    'active',
    v_reason
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;




REVOKE ALL ON FUNCTION public.waive_discipline_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_discipline_suspension_length(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_administrative_suspension(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waive_discipline_suspension(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.void_team_charge(
  p_charge_id uuid,
  p_reason text
)
RETURNS public.team_charges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_row public.team_charges;
  v_reason text := btrim(p_reason);
BEGIN
  PERFORM public.__assert_season_not_archived_for_team_charge(p_charge_id);
  SELECT * INTO v_row FROM public.team_charges WHERE id = p_charge_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'team_charge % does not exist', p_charge_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to void team_charge %', p_charge_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'team_charge % is already voided', p_charge_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.financial_void', 'true', true);

  UPDATE public.team_charges
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason,
    updated_at = now()
  WHERE id = p_charge_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;




REVOKE ALL ON TABLE public.team_charges FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.team_payments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.season_team_financial_summary FROM PUBLIC, anon;

GRANT SELECT, INSERT ON TABLE public.team_charges TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.void_team_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS public.team_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_row public.team_payments;
  v_reason text := btrim(p_reason);
BEGIN
  PERFORM public.__assert_season_not_archived_for_team_payment(p_payment_id);
  SELECT * INTO v_row FROM public.team_payments WHERE id = p_payment_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'team_payment % does not exist', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to void team_payment %', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'team_payment % is already voided', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.financial_void', 'true', true);

  UPDATE public.team_payments
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason,
    updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;




REVOKE ALL ON TABLE public.team_charges FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.team_payments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.season_team_financial_summary FROM PUBLIC, anon;

GRANT SELECT, INSERT ON TABLE public.team_charges TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.create_player_and_add_to_roster(
  p_season_team_id uuid,
  p_full_name text,
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
  v_name text;
  v_player_id uuid;
  v_stp_id uuid;
  v_is_admin boolean;
  v_is_leader boolean;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Season team id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
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

  v_name := btrim(COALESCE(p_full_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Player name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.players (organization_id, full_name, profile_id)
  VALUES (v_org_id, v_name, NULL)
  RETURNING id INTO v_player_id;

  v_stp_id := public.add_player_to_season_team(
    p_season_team_id,
    v_player_id,
    p_jersey_number,
    p_registration_status
  );

  RETURN v_stp_id;
END;
$$;




REVOKE ALL ON TABLE public.player_verification_reviews FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.player_transfer_lock_releases FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.player_verification_reviews TO authenticated;

-- patched from _generated_rpc_patches.sql
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
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
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




REVOKE ALL ON TABLE public.player_verification_reviews FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.player_transfer_lock_releases FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.player_verification_reviews TO authenticated;

-- patched from _generated_rpc_patches.sql
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
  PERFORM public.__assert_season_not_archived_for_season_team_player(p_season_team_player_id);
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




REVOKE ALL ON TABLE public.player_verification_reviews FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.player_transfer_lock_releases FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.player_verification_reviews TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.deactivate_season_team_player(
  p_season_team_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team_player(p_season_team_player_id);
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

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.set_season_team_captain(
  p_season_team_id uuid,
  p_player_id uuid
)
RETURNS public.season_team_players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_org_id uuid;
  v_row public.season_team_players;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Only organization_owner or organization_admin can set captain'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.* INTO v_row
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION
      'Player % is not on the roster of season_team %',
      p_player_id,
      p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.registration_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION
      'Player % must have registration_status = active to be captain (current: %)',
      p_player_id,
      v_row.registration_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_team_players
  SET is_captain = false
  WHERE season_team_id = p_season_team_id
    AND is_captain = true
    AND player_id IS DISTINCT FROM p_player_id;

  UPDATE public.season_team_players
  SET
    is_captain = true,
    is_vice_captain = false,
    registration_status = 'active'
  WHERE season_team_id = p_season_team_id
    AND player_id = p_player_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;




REVOKE ALL ON FUNCTION public.waive_discipline_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_discipline_suspension_length(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_administrative_suspension(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waive_discipline_suspension(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.set_season_team_vice_captain(
  p_season_team_id uuid,
  p_player_id uuid
)
RETURNS public.season_team_players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_row public.season_team_players;
  v_is_admin boolean;
  v_is_leader boolean;
  v_existing_vice uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', p_season_team_id
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

  SELECT stp.* INTO v_row
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION
      'Player % is not on the roster of season_team %',
      p_player_id,
      p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.registration_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION
      'Player % must have registration_status = active to be vice-captain (current: %)',
      p_player_id,
      v_row.registration_status
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_admin THEN
    SELECT stp.player_id INTO v_existing_vice
    FROM public.season_team_players stp
    WHERE stp.season_team_id = p_season_team_id
      AND stp.is_vice_captain = true
      AND stp.registration_status = 'active'
      AND stp.player_id IS DISTINCT FROM p_player_id
    LIMIT 1;

    IF v_existing_vice IS NOT NULL THEN
      RAISE EXCEPTION
        'Vice-captain slot is already filled; contact an administrator to replace'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.season_team_players
  SET is_vice_captain = false
  WHERE season_team_id = p_season_team_id
    AND is_vice_captain = true
    AND player_id IS DISTINCT FROM p_player_id;

  UPDATE public.season_team_players
  SET
    is_vice_captain = true,
    is_captain = false,
    registration_status = 'active'
  WHERE season_team_id = p_season_team_id
    AND player_id = p_player_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;




REVOKE ALL ON FUNCTION public.set_roster_lock(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_roster_lock(uuid, boolean) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.set_roster_lock(
  p_season_team_id uuid,
  p_locked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_updated integer;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL OR p_locked IS NULL THEN
    RAISE EXCEPTION 'Season team id and lock flag are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_teams
  SET roster_locked_by_captain = p_locked
  WHERE id = p_season_team_id
    AND organization_id = v_org;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update roster lock'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;




REVOKE ALL ON FUNCTION public.set_roster_lock(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_roster_lock(uuid, boolean) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.enroll_team_in_season(
  p_season_id uuid,
  p_team_id uuid,
  p_display_name text DEFAULT NULL,
  p_group_name text DEFAULT NULL,
  p_registration_status text DEFAULT 'registered'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_season_org uuid;
  v_team_org uuid;
  v_status text;
  v_display text;
  v_group text;
  v_season_team_id uuid;
  v_registration_fee numeric(12, 2);
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL OR p_team_id IS NULL THEN
    RAISE EXCEPTION 'Season id and team id are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT t.organization_id INTO v_team_org
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_team_org IS NULL THEN
    RAISE EXCEPTION 'Team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_season_org IS DISTINCT FROM v_team_org THEN
    RAISE EXCEPTION 'Team and season must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_season_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'registered');
  IF v_status NOT IN ('registered', 'confirmed', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  v_display := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_group := NULLIF(btrim(COALESCE(p_group_name, '')), '');

  IF v_display IS NOT NULL AND char_length(v_display) > 100 THEN
    RAISE EXCEPTION 'Display name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_group IS NOT NULL AND char_length(v_group) > 100 THEN
    RAISE EXCEPTION 'Group name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT sr.registration_fee INTO v_registration_fee
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  INSERT INTO public.season_teams (
    season_id,
    team_id,
    organization_id,
    display_name,
    group_name,
    registration_status
  ) VALUES (
    p_season_id,
    p_team_id,
    v_season_org,
    v_display,
    v_group,
    v_status
  )
  RETURNING id INTO v_season_team_id;

  IF v_registration_fee IS NOT NULL THEN
    INSERT INTO public.team_charges (
      organization_id,
      season_team_id,
      charge_type,
      description,
      amount,
      created_by_profile_id
    ) VALUES (
      v_season_org,
      v_season_team_id,
      'registration',
      'Cuota de inscripción',
      v_registration_fee,
      v_uid
    );
  END IF;

  RETURN v_season_team_id;
END;
$$;




REVOKE ALL ON TABLE public.player_verification_reviews FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.player_transfer_lock_releases FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.player_verification_reviews TO authenticated;

-- patched from _generated_rpc_patches.sql
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
  PERFORM public.__assert_season_not_archived(p_season_id);
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




REVOKE ALL ON TABLE public.player_verification_reviews FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.player_transfer_lock_releases FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.player_verification_reviews TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.configure_knockout_round(
  p_round_id uuid,
  p_is_two_legs boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_round record;
  v_tie record;
  v_active integer;
BEGIN
  PERFORM public.__assert_season_not_archived_for_knockout_round(p_round_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_round_id IS NULL OR p_is_two_legs IS NULL THEN
    RAISE EXCEPTION 'Round id and is_two_legs are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT kr.*
  INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.id = p_round_id;

  IF v_round.id IS NULL THEN
    RAISE EXCEPTION 'Knockout round not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_round.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM public.matches m
  WHERE m.knockout_round_id = p_round_id
    AND m.status <> 'scheduled';

  IF v_active > 0 THEN
    RAISE EXCEPTION 'Cannot reconfigure a round after matches have started or finished'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_round.is_two_legs IS NOT DISTINCT FROM p_is_two_legs THEN
    RETURN;
  END IF;

  UPDATE public.season_knockout_rounds
  SET is_two_legs = p_is_two_legs
  WHERE id = p_round_id;

  IF p_is_two_legs THEN
    FOR v_tie IN
      SELECT t.*
      FROM public.season_knockout_ties t
      WHERE t.knockout_round_id = p_round_id
        AND t.away_season_team_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.knockout_round_id = p_round_id
          AND m.bracket_slot = v_tie.bracket_slot
          AND m.leg_number = 2
      ) THEN
        INSERT INTO public.matches (
          season_id,
          organization_id,
          home_season_team_id,
          away_season_team_id,
          status,
          knockout_round_id,
          bracket_slot,
          leg_number,
          round_label
        ) VALUES (
          v_round.season_id,
          v_round.organization_id,
          v_tie.away_season_team_id,
          v_tie.home_season_team_id,
          'scheduled',
          p_round_id,
          v_tie.bracket_slot,
          2,
          v_round.round_label
        );
      END IF;
    END LOOP;
  ELSE
    DELETE FROM public.matches m
    WHERE m.knockout_round_id = p_round_id
      AND m.leg_number = 2
      AND m.status = 'scheduled';
  END IF;
END;
$$;




REVOKE ALL ON FUNCTION public.configure_knockout_round(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configure_knockout_round(uuid, boolean) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.set_knockout_tie_penalty_winner(
  p_round_id uuid,
  p_bracket_slot integer,
  p_winner_season_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_round record;
  v_tie_id uuid;
  v_tie record;
BEGIN
  PERFORM public.__assert_season_not_archived_for_knockout_round(p_round_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_round_id IS NULL OR p_bracket_slot IS NULL OR p_winner_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Round, bracket slot and winner are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT kr.* INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.id = p_round_id;

  IF v_round.id IS NULL THEN
    RAISE EXCEPTION 'Knockout round not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_round.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.id, t.home_season_team_id, t.away_season_team_id
  INTO v_tie
  FROM public.season_knockout_ties t
  WHERE t.knockout_round_id = p_round_id
    AND t.bracket_slot = p_bracket_slot;

  IF v_tie.id IS NULL THEN
    RAISE EXCEPTION 'Tie not found for bracket slot %', p_bracket_slot USING ERRCODE = 'P0001';
  END IF;

  IF v_tie.away_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Bye ties do not require penalties' USING ERRCODE = 'P0001';
  END IF;

  IF p_winner_season_team_id NOT IN (v_tie.home_season_team_id, v_tie.away_season_team_id) THEN
    RAISE EXCEPTION 'Winner must be one of the tie teams' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.__knockout_tie_is_tied(v_tie.id) THEN
    RAISE EXCEPTION 'Penalty winner can only be set when the tie is drawn on aggregate'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_knockout_ties
  SET penalty_winner_season_team_id = p_winner_season_team_id
  WHERE id = v_tie.id;
END;
$$;




REVOKE ALL ON FUNCTION public.set_knockout_tie_penalty_winner(uuid, integer, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_knockout_tie_penalty_winner(uuid, integer, uuid)
  TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.advance_knockout_round(
  p_season_id uuid,
  p_round_number integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_round record;
  v_next_round_number integer;
  v_current_slots integer;
  v_next_slots integer;
  v_next_round_id uuid;
  v_next_label text;
  v_tie record;
  v_winner uuid;
  v_winners uuid[];
  v_unresolved integer[];
  v_slot integer;
  v_home uuid;
  v_away uuid;
  v_champion uuid;
BEGIN
  PERFORM public.__assert_season_not_archived(p_season_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT kr.*
  INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.season_id = p_season_id
    AND kr.round_number = p_round_number;

  IF v_round.id IS NULL THEN
    RAISE EXCEPTION 'Knockout round % not found', p_round_number USING ERRCODE = 'P0001';
  END IF;

  v_unresolved := ARRAY[]::integer[];
  v_winners := ARRAY[]::uuid[];

  FOR v_tie IN
    SELECT t.*
    FROM public.season_knockout_ties t
    WHERE t.knockout_round_id = v_round.id
    ORDER BY t.bracket_slot
  LOOP
    v_winner := public.__knockout_resolve_tie_winner(v_tie.id);
    IF v_winner IS NULL THEN
      v_unresolved := v_unresolved || v_tie.bracket_slot;
    ELSE
      v_winners[v_tie.bracket_slot] := v_winner;
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_unresolved, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Unresolved bracket slots in round %: %',
      p_round_number,
      array_to_string(v_unresolved, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  v_current_slots := v_round.bracket_size / (2 ^ p_round_number);

  IF v_current_slots <= 1 THEN
    v_champion := v_winners[1];
    RETURN jsonb_build_object(
      'season_id', p_season_id,
      'completed_round', p_round_number,
      'is_final', true,
      'champion_season_team_id', v_champion
    );
  END IF;

  v_next_round_number := p_round_number + 1;
  v_next_slots := v_current_slots / 2;

  IF EXISTS (
    SELECT 1 FROM public.season_knockout_rounds kr
    WHERE kr.season_id = p_season_id
      AND kr.round_number = v_next_round_number
  ) THEN
    RAISE EXCEPTION 'Next knockout round already exists' USING ERRCODE = 'P0001';
  END IF;

  v_next_label := public.__knockout_round_label(v_round.bracket_size, v_next_round_number);

  INSERT INTO public.season_knockout_rounds (
    organization_id,
    season_id,
    round_number,
    round_label,
    bracket_size,
    is_two_legs
  ) VALUES (
    v_org,
    p_season_id,
    v_next_round_number,
    v_next_label,
    v_round.bracket_size,
    false
  )
  RETURNING id INTO v_next_round_id;

  FOR v_slot IN 1..v_next_slots LOOP
    v_home := v_winners[(v_slot * 2) - 1];
    v_away := v_winners[v_slot * 2];

    INSERT INTO public.season_knockout_ties (
      organization_id,
      season_id,
      knockout_round_id,
      bracket_slot,
      home_season_team_id,
      away_season_team_id
    ) VALUES (
      v_org,
      p_season_id,
      v_next_round_id,
      v_slot,
      v_home,
      v_away
    );

    PERFORM public.__knockout_create_tie_matches(
      v_org,
      p_season_id,
      v_next_round_id,
      v_next_label,
      v_slot,
      v_home,
      v_away,
      false
    );
  END LOOP;

  RETURN jsonb_build_object(
    'season_id', p_season_id,
    'completed_round', p_round_number,
    'next_round_id', v_next_round_id,
    'next_round_number', v_next_round_number,
    'next_round_label', v_next_label,
    'is_final', false
  );
END;
$$;




REVOKE ALL ON FUNCTION public.advance_knockout_round(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_knockout_round(uuid, integer) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.invite_captain_to_roster(
  p_season_team_player_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
  v_is_leader boolean;
  v_invitation_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_email := lower(btrim(COALESCE(p_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Valid email is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    stp.organization_id,
    (stp.is_captain = true OR stp.is_vice_captain = true)
  INTO v_org, v_is_leader
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_is_leader, false) THEN
    RAISE EXCEPTION 'Player must be marked as captain or vice-captain before sending invitation'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.captain_invitations
  SET status = 'cancelled'
  WHERE season_team_player_id = p_season_team_player_id
    AND status = 'pending';

  INSERT INTO public.captain_invitations (
    organization_id,
    season_team_player_id,
    email,
    invited_by_profile_id,
    expires_at
  ) VALUES (
    v_org,
    p_season_team_player_id,
    v_email,
    v_uid,
    now() + interval '7 days'
  )
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;




REVOKE ALL ON FUNCTION public.waive_discipline_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_discipline_suspension_length(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_administrative_suspension(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waive_discipline_suspension(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.create_captain_player_with_invitation(
  p_season_team_id uuid,
  p_full_name text,
  p_email text,
  p_jersey_number integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_stp_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  v_stp_id := public.create_player_and_add_to_roster(
    p_season_team_id,
    p_full_name,
    p_jersey_number,
    'active'
  );

  PERFORM public.set_season_team_captain(
    p_season_team_id,
    (
      SELECT stp.player_id
      FROM public.season_team_players stp
      WHERE stp.id = v_stp_id
    )
  );

  PERFORM public.invite_captain_to_roster(v_stp_id, p_email);

  RETURN v_stp_id;
END;
$$;




REVOKE ALL ON FUNCTION public.invite_captain_to_roster(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_captain_player_with_invitation(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_captain_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_captain_to_roster(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.accept_captain_invitation(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_inv public.captain_invitations;
  v_profile_email text;
  v_player_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_captain_invitation(p_token);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Invitation token is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv
  FROM public.captain_invitations ci
  WHERE ci.token = p_token;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.captain_invitations
    SET status = 'expired'
    WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(btrim(p.email)) INTO v_profile_email
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_profile_email IS DISTINCT FROM lower(btrim(v_inv.email)) THEN
    RAISE EXCEPTION 'Invitation email does not match your account'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.player_id INTO v_player_id
  FROM public.season_team_players stp
  WHERE stp.id = v_inv.season_team_player_id;

  UPDATE public.players
  SET profile_id = v_uid
  WHERE id = v_player_id
    AND organization_id = v_inv.organization_id
    AND (
      profile_id IS NULL
      OR profile_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not link profile to player record'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.captain_invitations
  SET
    status = 'accepted',
    accepted_by_profile_id = v_uid
  WHERE id = v_inv.id;

  RETURN v_inv.season_team_player_id;
END;
$$;




REVOKE ALL ON FUNCTION public.invite_captain_to_roster(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_captain_player_with_invitation(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_captain_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_captain_to_roster(uuid, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.set_player_payment_mark(
  p_season_team_player_id uuid,
  p_marked_paid boolean,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_season_team uuid;
  v_notes text;
  v_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL OR p_marked_paid IS NULL THEN
    RAISE EXCEPTION 'Season team player id and marked_paid are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id, stp.season_team_id
  INTO v_org, v_season_team
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_or_vice_of_season_team(v_season_team, v_uid) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  INSERT INTO public.season_team_player_payment_marks (
    organization_id,
    season_team_player_id,
    marked_paid,
    marked_by_profile_id,
    notes
  ) VALUES (
    v_org,
    p_season_team_player_id,
    p_marked_paid,
    v_uid,
    v_notes
  )
  ON CONFLICT (season_team_player_id) DO UPDATE
  SET
    marked_paid = EXCLUDED.marked_paid,
    marked_by_profile_id = EXCLUDED.marked_by_profile_id,
    notes = EXCLUDED.notes
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;




REVOKE ALL ON FUNCTION public.set_player_payment_mark(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_payment_mark(uuid, boolean, text) TO authenticated;

-- patched from _generated_rpc_patches.sql
CREATE OR REPLACE FUNCTION public.__schedule_match_core(
  p_match_id uuid,
  p_field_id uuid,
  p_starts_at timestamptz,
  p_calendar_status text DEFAULT 'programado'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$


DECLARE
  v_org uuid;
  v_season uuid;
  v_status text;
  v_existing_res uuid;
  v_field_active boolean;
  v_venue_active boolean;
  v_field_org uuid;
  v_duration integer;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_dow integer;
  v_start_time time;
  v_end_time time;
  v_rule_count integer;
  v_res_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF p_match_id IS NULL OR p_field_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'Match, field and starts_at are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_calendar_status NOT IN ('programado', 'confirmado') THEN
    RAISE EXCEPTION 'Invalid calendar_status'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.season_id, m.status, m.field_reservation_id
  INTO v_org, v_season, v_status, v_existing_res
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled matches can be programmed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    f.is_active,
    f.organization_id,
    v.is_active
  INTO v_field_active, v_field_org, v_venue_active
  FROM public.fields f
  JOIN public.venues v ON v.id = f.venue_id
  WHERE f.id = p_field_id;

  IF v_field_org IS NULL THEN
    RAISE EXCEPTION 'Field not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_field_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Field does not belong to this organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_field_active, false) THEN
    RAISE EXCEPTION 'Field is inactive'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_venue_active, false) THEN
    RAISE EXCEPTION 'Venue is inactive'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(sr.match_duration_minutes, 0)
      + COALESCE(sr.minimum_rest_minutes, 0)
  INTO v_duration
  FROM public.season_rules sr
  WHERE sr.season_id = v_season;

  IF v_duration IS NULL OR v_duration <= 0 THEN
    RAISE EXCEPTION 'Season match duration is not configured'
      USING ERRCODE = 'P0001';
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  v_local_start := p_starts_at AT TIME ZONE 'America/Mexico_City';
  v_local_end := v_ends_at AT TIME ZONE 'America/Mexico_City';

  IF v_local_start::date IS DISTINCT FROM v_local_end::date THEN
    RAISE EXCEPTION 'Match slot cannot cross midnight in America/Mexico_City'
      USING ERRCODE = 'P0001';
  END IF;

  v_dow := EXTRACT(DOW FROM v_local_start)::integer;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  SELECT COUNT(*) INTO v_rule_count
  FROM public.field_availability_rules far
  WHERE far.field_id = p_field_id
    AND far.day_of_week = v_dow;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION 'Field has no availability rules for this weekday'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_rule_count
  FROM public.field_availability_rules far
  WHERE far.field_id = p_field_id
    AND far.day_of_week = v_dow
    AND v_start_time >= far.starts_at
    AND v_end_time <= far.ends_at;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION 'Slot is outside field availability'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_field_slot_not_blocked_by_other_season(
    p_field_id,
    v_dow,
    v_start_time,
    v_end_time,
    v_season
  );

  IF v_existing_res IS NOT NULL THEN
    UPDATE public.field_reservations fr
    SET
      field_id = p_field_id,
      starts_at = p_starts_at,
      ends_at = v_ends_at,
      reservation_type = 'match',
      match_id = p_match_id,
      status = 'confirmed',
      title = COALESCE(fr.title, 'Partido')
    WHERE fr.id = v_existing_res
      AND fr.organization_id = v_org;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Existing reservation not found for match'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT fr.id INTO v_res_id
    FROM public.field_reservations fr
    WHERE fr.match_id = p_match_id
      AND fr.organization_id = v_org
      AND fr.reservation_type = 'match'
    ORDER BY fr.updated_at DESC
    LIMIT 1;

    IF v_res_id IS NOT NULL THEN
      UPDATE public.field_reservations
      SET
        field_id = p_field_id,
        starts_at = p_starts_at,
        ends_at = v_ends_at,
        status = 'confirmed',
        reservation_type = 'match',
        match_id = p_match_id,
        title = COALESCE(title, 'Partido')
      WHERE id = v_res_id;

      UPDATE public.matches
      SET field_reservation_id = v_res_id
      WHERE id = p_match_id
        AND organization_id = v_org;
    ELSE
      INSERT INTO public.field_reservations (
        organization_id,
        field_id,
        reservation_type,
        match_id,
        starts_at,
        ends_at,
        title,
        status
      ) VALUES (
        v_org,
        p_field_id,
        'match',
        p_match_id,
        p_starts_at,
        v_ends_at,
        'Partido',
        'confirmed'
      )
      RETURNING id INTO v_res_id;

      UPDATE public.matches
      SET field_reservation_id = v_res_id
      WHERE id = p_match_id
        AND organization_id = v_org;
    END IF;
  END IF;

  UPDATE public.matches
  SET calendar_status = p_calendar_status
  WHERE id = p_match_id
    AND organization_id = v_org;
END;
$$;