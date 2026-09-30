-- Official score follows goal events unless score_manual_override is set.
-- Cursor writes this file only; it is not applied from here.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS score_manual_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.matches.score_manual_override IS
  'When true, home_score/away_score are an explicit correction and goal events do not overwrite them.';

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_source_check;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_source_check CHECK (
    source IN ('database_trigger', 'system_trigger', 'system:events')
  );

-- Tag automatic match-score updates. Empty app.audit_source keeps the previous behavior.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_excluded text[] := ARRAY[]::text[];
  v_arg text;
  v_org_id uuid;
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := ARRAY[]::text[];
  v_key text;
  v_old_val jsonb;
  v_new_val jsonb;
  v_source text := NULLIF(current_setting('app.audit_source', true), '');
  v_actor uuid;
BEGIN
  IF v_source IS NULL THEN
    v_source := 'database_trigger';
  END IF;
  v_actor := CASE WHEN v_source = 'system:events' THEN NULL ELSE auth.uid() END;

  IF TG_TABLE_NAME = 'audit_log' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_NARGS > 0 AND TG_ARGV[0] IS NOT NULL AND btrim(TG_ARGV[0]) <> '' THEN
    v_arg := replace(TG_ARGV[0], ' ', '');
    v_excluded := string_to_array(v_arg, ',');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := NEW.id;
    ELSE
      v_org_id := NEW.organization_id;
    END IF;
    v_entity_id := NEW.id;
    v_after := to_jsonb(NEW);
    IF v_excluded IS NOT NULL THEN
      v_after := v_after - v_excluded;
    END IF;

    INSERT INTO public.audit_log (
      organization_id, actor_profile_id, entity_type, entity_id, action,
      before_data, after_data, changed_fields, source
    ) VALUES (
      v_org_id, v_actor, TG_TABLE_NAME, v_entity_id, 'insert',
      NULL, v_after, '{}', v_source
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := NEW.id;
    ELSE
      v_org_id := NEW.organization_id;
    END IF;
    v_entity_id := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    IF v_excluded IS NOT NULL THEN
      v_before := v_before - v_excluded;
      v_after := v_after - v_excluded;
    END IF;

    FOR v_key IN
      SELECT DISTINCT k
      FROM (
        SELECT jsonb_object_keys(v_before) AS k
        UNION
        SELECT jsonb_object_keys(v_after) AS k
      ) keys
    LOOP
      IF v_key = 'updated_at' THEN
        CONTINUE;
      END IF;
      v_old_val := v_before -> v_key;
      v_new_val := v_after -> v_key;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;

    IF coalesce(array_length(v_changed, 1), 0) = 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.audit_log (
      organization_id, actor_profile_id, entity_type, entity_id, action,
      before_data, after_data, changed_fields, source
    ) VALUES (
      v_org_id, v_actor, TG_TABLE_NAME, v_entity_id, 'update',
      v_before, v_after, v_changed, v_source
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := OLD.id;
    ELSE
      v_org_id := OLD.organization_id;
    END IF;
    v_entity_id := OLD.id;
    v_before := to_jsonb(OLD);
    IF v_excluded IS NOT NULL THEN
      v_before := v_before - v_excluded;
    END IF;

    INSERT INTO public.audit_log (
      organization_id, actor_profile_id, entity_type, entity_id, action,
      before_data, after_data, changed_fields, source
    ) VALUES (
      v_org_id, v_actor, TG_TABLE_NAME, v_entity_id, 'delete',
      v_before, NULL, '{}', v_source
    );
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

-- Same tally as goalsFromEvents: ignore voided rows; own goals credit the opponent.
CREATE OR REPLACE FUNCTION public.sync_match_score_from_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_override boolean;
  v_home_team uuid;
  v_away_team uuid;
  v_home integer;
  v_away integer;
  v_new_home integer;
  v_new_away integer;
BEGIN
  IF NEW.event_type NOT IN ('goal', 'own_goal') THEN
    RETURN NEW;
  END IF;

  SELECT
    m.status,
    m.score_manual_override,
    m.home_season_team_id,
    m.away_season_team_id,
    m.home_score,
    m.away_score
  INTO
    v_status,
    v_override,
    v_home_team,
    v_away_team,
    v_home,
    v_away
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_override OR v_status IN ('finished', 'walkover', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(SUM(
      CASE
        WHEN e.voided_at IS NOT NULL THEN 0
        WHEN e.event_type = 'goal' AND stp.season_team_id = v_home_team THEN 1
        WHEN e.event_type = 'own_goal' AND stp.season_team_id = v_away_team THEN 1
        ELSE 0
      END
    ), 0)::integer,
    COALESCE(SUM(
      CASE
        WHEN e.voided_at IS NOT NULL THEN 0
        WHEN e.event_type = 'goal' AND stp.season_team_id = v_away_team THEN 1
        WHEN e.event_type = 'own_goal' AND stp.season_team_id = v_home_team THEN 1
        ELSE 0
      END
    ), 0)::integer
  INTO v_new_home, v_new_away
  FROM public.match_events e
  JOIN public.season_team_players stp ON stp.id = e.season_team_player_id
  WHERE e.match_id = NEW.match_id
    AND e.event_type IN ('goal', 'own_goal');

  IF v_home IS NOT DISTINCT FROM v_new_home
     AND v_away IS NOT DISTINCT FROM v_new_away THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.audit_source', 'system:events', true);
  UPDATE public.matches
  SET
    home_score = v_new_home,
    away_score = v_new_away,
    updated_at = now()
  WHERE id = NEW.match_id;
  PERFORM set_config('app.audit_source', '', true);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_match_score_from_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS match_events_sync_score ON public.match_events;
CREATE TRIGGER match_events_sync_score
  AFTER INSERT OR UPDATE OF voided_at
  ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_match_score_from_events();

COMMENT ON FUNCTION public.sync_match_score_from_events() IS
  'Recalculates matches.home_score/away_score from goal events. Skips manual overrides and closed matches. Audit source system:events.';

DROP FUNCTION IF EXISTS public.update_match_result(uuid, text, integer, integer);

CREATE FUNCTION public.update_match_result(
  p_match_id uuid,
  p_status text,
  p_home_score integer,
  p_away_score integer,
  p_score_manual_override boolean DEFAULT false
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_is_privileged boolean;
  v_is_confirmed_referee boolean;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  v_is_privileged := (
    public.has_role_in_org(
      v_match.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(v_match.season_id, ARRAY['tournament_admin']::text[])
  );
  v_is_confirmed_referee := public.is_confirmed_match_referee(p_match_id);

  IF NOT (v_is_privileged OR v_is_confirmed_referee) THEN
    RAISE EXCEPTION
      'Not authorized to update match result for match %',
      p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_confirmed_referee AND NOT v_is_privileged THEN
    IF v_match.status IN ('finished', 'walkover', 'cancelled') THEN
      RAISE EXCEPTION
        'Confirmed referee cannot modify a closed match result'
        USING ERRCODE = 'P0001';
    END IF;

    IF p_status NOT IN ('finished', 'walkover') THEN
      RAISE EXCEPTION
        'Confirmed referee can only set status to finished or walkover'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public.__assert_match_capture_window(p_match_id);

  IF p_status IN ('finished', 'walkover') THEN
    PERFORM public.__assert_match_teams_have_active_roster_for_close(
      v_match.home_season_team_id,
      v_match.away_season_team_id
    );
  END IF;

  UPDATE public.matches
  SET
    status = p_status,
    home_score = p_home_score,
    away_score = p_away_score,
    score_manual_override = p_score_manual_override,
    updated_at = now(),
    result_review_opened_at = CASE
      WHEN p_status IN ('finished', 'walkover') THEN now()
      ELSE result_review_opened_at
    END,
    result_review_auto_close_at = CASE
      WHEN p_status IN ('finished', 'walkover') THEN now() + interval '24 hours'
      ELSE result_review_auto_close_at
    END,
    result_approved_at = CASE
      WHEN p_status IN ('finished', 'walkover') THEN NULL
      ELSE result_approved_at
    END,
    result_approved_by_profile_id = CASE
      WHEN p_status IN ('finished', 'walkover') THEN NULL
      ELSE result_approved_by_profile_id
    END
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  IF p_status IN ('finished', 'walkover', 'cancelled') THEN
    UPDATE public.match_officials
    SET
      invite_expires_at = now(),
      updated_at = now()
    WHERE match_id = p_match_id
      AND invite_token IS NOT NULL
      AND (invite_expires_at IS NULL OR invite_expires_at > now());
  END IF;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.update_match_result(uuid, text, integer, integer, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_match_result(uuid, text, integer, integer, boolean)
  TO authenticated;

DROP FUNCTION IF EXISTS public.guest_update_match_result(uuid, uuid, text, integer, integer);

CREATE FUNCTION public.guest_update_match_result(
  p_token uuid,
  p_match_id uuid,
  p_status text,
  p_home_score integer,
  p_away_score integer,
  p_score_manual_override boolean DEFAULT false
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_official public.match_officials;
  v_match public.matches;
BEGIN
  v_official := public.__fetch_valid_guest_official(p_token, p_match_id, true);

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_match.status IN ('finished', 'walkover', 'cancelled') THEN
    RAISE EXCEPTION
      'Confirmed referee cannot modify a closed match result'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_status NOT IN ('finished', 'walkover') THEN
    RAISE EXCEPTION
      'Confirmed referee can only set status to finished or walkover'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_match_capture_window(p_match_id);

  PERFORM public.__assert_match_teams_have_active_roster_for_close(
    v_match.home_season_team_id,
    v_match.away_season_team_id
  );

  UPDATE public.matches
  SET
    status = p_status,
    home_score = p_home_score,
    away_score = p_away_score,
    score_manual_override = p_score_manual_override,
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  PERFORM public.set_match_context(
    p_match_id,
    NULL,
    NULL,
    v_official.guest_name,
    NULL
  );

  UPDATE public.match_officials
  SET
    invite_expires_at = now(),
    updated_at = now()
  WHERE id = v_official.id;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_update_match_result(uuid, uuid, text, integer, integer, boolean)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_update_match_result(uuid, uuid, text, integer, integer, boolean)
  TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_guest_match_snapshot(uuid);

CREATE FUNCTION public.get_guest_match_snapshot(p_token uuid)
RETURNS TABLE (
  match_id uuid,
  status text,
  home_score integer,
  away_score integer,
  calendar_status text,
  home_name text,
  away_name text,
  home_season_team_id uuid,
  away_season_team_id uuid,
  starts_at timestamptz,
  score_manual_override boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
BEGIN
  v_row := public.__fetch_valid_guest_official(p_token, NULL, false);

  RETURN QUERY
  SELECT
    m.id,
    m.status,
    m.home_score,
    m.away_score,
    m.calendar_status,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name) AS home_name,
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name) AS away_name,
    m.home_season_team_id,
    m.away_season_team_id,
    fr.starts_at,
    m.score_manual_override
  FROM public.matches m
  JOIN public.season_teams sth ON sth.id = m.home_season_team_id
  JOIN public.teams th ON th.id = sth.team_id
  JOIN public.season_teams sta ON sta.id = m.away_season_team_id
  JOIN public.teams ta ON ta.id = sta.team_id
  LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  WHERE m.id = v_row.match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_match_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_match_snapshot(uuid) TO anon, authenticated;
