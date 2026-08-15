-- Migration 030: plan tier, season team status, match void, jornada summaries, bulk RPCs
-- ADRs: 0015, 0016, 0017, 0018

-- =============================================================================
-- 1) organizations.plan_tier (ADR-0017)
-- =============================================================================
ALTER TABLE public.organizations
  ADD COLUMN plan_tier text NOT NULL DEFAULT 'basico',
  ADD CONSTRAINT organizations_plan_tier_check CHECK (
    plan_tier IN ('basico', 'premium')
  );

COMMENT ON COLUMN public.organizations.plan_tier IS
  'Commercial tier. Writable only via set_organization_plan_tier (platform staff).';

CREATE OR REPLACE FUNCTION public.organization_has_premium(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_organization_id
      AND o.plan_tier = 'premium'
  );
$$;

REVOKE ALL ON FUNCTION public.organization_has_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organization_has_premium(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_organization_plan_tier(
  p_organization_id uuid,
  p_plan_tier text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.organizations;
  v_tier text := btrim(COALESCE(p_plan_tier, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required' USING ERRCODE = 'P0001';
  END IF;

  IF v_tier NOT IN ('basico', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan_tier' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organizations
  SET plan_tier = v_tier, updated_at = now()
  WHERE id = p_organization_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_organization_plan_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_organization_plan_tier(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_organizations_billing()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  plan_tier text,
  active_season_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.plan_tier,
    (
      SELECT COUNT(*)::bigint
      FROM public.seasons s
      WHERE s.organization_id = o.id
        AND s.visibility NOT IN ('archived', 'draft')
    ) AS active_season_count
  FROM public.organizations o
  ORDER BY o.name ASC, o.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_organizations_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_organizations_billing() TO authenticated;

-- =============================================================================
-- 2) season_teams.status + season_rules walkover + seasons enrollment deadline (ADR-0015)
-- =============================================================================
ALTER TABLE public.season_teams
  ADD COLUMN status text NOT NULL DEFAULT 'activo',
  ADD COLUMN status_effective_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT season_teams_status_check CHECK (
    status IN ('activo', 'retirado', 'suspendido')
  );

COMMENT ON COLUMN public.season_teams.status IS
  'Operational status during season. Changed via set_season_team_status RPC only.';

ALTER TABLE public.season_rules
  ADD COLUMN walkover_en_retiro boolean NOT NULL DEFAULT false,
  ADD COLUMN walkover_retiro_home_goals integer NOT NULL DEFAULT 3,
  ADD COLUMN walkover_retiro_away_goals integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT season_rules_walkover_retiro_home_goals_check CHECK (
    walkover_retiro_home_goals >= 0
  ),
  ADD CONSTRAINT season_rules_walkover_retiro_away_goals_check CHECK (
    walkover_retiro_away_goals >= 0
  );

ALTER TABLE public.seasons
  ADD COLUMN fecha_limite_inscripcion date;

COMMENT ON COLUMN public.seasons.fecha_limite_inscripcion IS
  'Optional enrollment cutoff. enroll_team_in_season rejects new teams after this date.';

-- =============================================================================
-- 3) matches void columns + void_match RPC (ADR-0015)
-- =============================================================================
ALTER TABLE public.matches
  ADD COLUMN voided_at timestamptz,
  ADD COLUMN voided_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN void_reason text,
  ADD CONSTRAINT matches_void_all_or_none_check CHECK (
    (
      voided_at IS NULL
      AND voided_by_profile_id IS NULL
      AND void_reason IS NULL
    )
    OR (
      voided_at IS NOT NULL
      AND voided_by_profile_id IS NOT NULL
      AND void_reason IS NOT NULL
      AND btrim(void_reason) <> ''
    )
  );

CREATE INDEX matches_active_scheduled_idx
  ON public.matches (season_id, status)
  WHERE voided_at IS NULL;

CREATE OR REPLACE FUNCTION public.void_match(
  p_match_id uuid,
  p_reason text
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.matches;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.matches WHERE id = p_match_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'match % does not exist', p_match_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to void match %', p_match_id USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'match % is already voided', p_match_id USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status NOT IN ('scheduled') THEN
    RAISE EXCEPTION 'Only scheduled matches can be voided (status: %)', v_row.status
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.matches
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason,
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.void_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_match(uuid, text) TO authenticated;

-- =============================================================================
-- 4) set_season_team_status (ADR-0015)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_season_team_status(
  p_season_team_id uuid,
  p_status text,
  p_reason text,
  p_effective_at timestamptz DEFAULT NULL
)
RETURNS public.season_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.season_teams;
  v_status text := btrim(COALESCE(p_status, ''));
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_effective timestamptz := COALESCE(p_effective_at, now());
  v_match record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.season_teams WHERE id = p_season_team_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'season_team % does not exist', p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('activo', 'retirado', 'suspendido') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = 'P0001';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Reason is required for status change' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_teams
  SET
    status = v_status,
    status_effective_at = v_effective,
    updated_at = now()
  WHERE id = p_season_team_id
  RETURNING * INTO v_row;

  IF v_status = 'retirado' THEN
    FOR v_match IN
      SELECT m.id
      FROM public.matches m
      WHERE m.season_id = v_row.season_id
        AND m.voided_at IS NULL
        AND m.status = 'scheduled'
        AND (
          m.home_season_team_id = v_row.id
          OR m.away_season_team_id = v_row.id
        )
    LOOP
      PERFORM public.void_match(v_match.id, 'equipo retirado');
    END LOOP;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_season_team_status(uuid, text, text, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_team_status(uuid, text, text, timestamptz)
  TO authenticated;

-- =============================================================================
-- 5) enroll_team_in_season — enrollment deadline (ADR-0015)
-- =============================================================================
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
  v_fecha_limite date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL OR p_team_id IS NULL THEN
    RAISE EXCEPTION 'Season id and team id are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.fecha_limite_inscripcion
  INTO v_season_org, v_fecha_limite
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_fecha_limite IS NOT NULL AND current_date > v_fecha_limite THEN
    RAISE EXCEPTION
      'Inscripciones cerradas: la fecha límite fue %',
      to_char(v_fecha_limite, 'YYYY-MM-DD')
      USING ERRCODE = 'P0001';
  END IF;

  SELECT t.organization_id INTO v_team_org
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_team_org IS NULL THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_season_org IS DISTINCT FROM v_team_org THEN
    RAISE EXCEPTION 'Team and season must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_season_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'registered');
  IF v_status NOT IN ('registered', 'confirmed', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid registration_status' USING ERRCODE = 'P0001';
  END IF;

  v_display := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_group := NULLIF(btrim(COALESCE(p_group_name, '')), '');

  IF v_display IS NOT NULL AND char_length(v_display) > 100 THEN
    RAISE EXCEPTION 'Display name must be at most 100 characters' USING ERRCODE = 'P0001';
  END IF;

  IF v_group IS NOT NULL AND char_length(v_group) > 100 THEN
    RAISE EXCEPTION 'Group name must be at most 100 characters' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.season_teams (
    season_id,
    team_id,
    organization_id,
    display_name,
    group_name,
    registration_status,
    status,
    status_effective_at
  ) VALUES (
    p_season_id,
    p_team_id,
    v_season_org,
    v_display,
    v_group,
    v_status,
    'activo',
    now()
  )
  RETURNING id INTO v_season_team_id;

  RETURN v_season_team_id;
END;
$$;

-- =============================================================================
-- 6) __season_standings_core — withdrawal void walkover (ADR-0015)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.__season_standings_core(
  p_season_id uuid,
  p_group_id uuid DEFAULT NULL
)
RETURNS TABLE (
  "position" integer,
  season_team_id uuid,
  team_id uuid,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_win integer;
  v_points_draw integer;
  v_points_loss integer;
  v_walkover_en_retiro boolean;
  v_wo_home integer;
  v_wo_away integer;
BEGIN
  SELECT
    sr.points_win,
    sr.points_draw,
    sr.points_loss,
    sr.walkover_en_retiro,
    sr.walkover_retiro_home_goals,
    sr.walkover_retiro_away_goals
  INTO
    v_points_win,
    v_points_draw,
    v_points_loss,
    v_walkover_en_retiro,
    v_wo_home,
    v_wo_away
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_points_win IS NULL THEN
    RETURN;
  END IF;

  IF p_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.season_groups sg
    WHERE sg.id = p_group_id AND sg.season_id = p_season_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH teams AS (
    SELECT
      st.id AS season_team_id,
      st.team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      st.registration_status
    FROM public.season_teams st
    JOIN public.teams t ON t.id = st.team_id
    WHERE st.season_id = p_season_id
      AND (p_group_id IS NULL OR st.season_group_id = p_group_id)
  ),
  official AS (
    SELECT
      m.id,
      m.home_season_team_id,
      m.away_season_team_id,
      m.home_score,
      m.away_score,
      m.created_at,
      fr.starts_at
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.season_id = p_season_id
      AND m.knockout_round_id IS NULL
      AND (p_group_id IS NULL OR m.season_group_id = p_group_id)
      AND m.voided_at IS NULL
      AND m.status IN ('finished', 'walkover')
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  ),
  withdrawal_walkover AS (
    SELECT
      m.id,
      m.home_season_team_id,
      m.away_season_team_id,
      CASE
        WHEN hs.status = 'retirado' THEN v_wo_away
        WHEN aws.status = 'retirado' THEN v_wo_home
        ELSE NULL
      END AS home_score,
      CASE
        WHEN hs.status = 'retirado' THEN v_wo_home
        WHEN aws.status = 'retirado' THEN v_wo_away
        ELSE NULL
      END AS away_score,
      m.created_at,
      fr.starts_at
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    JOIN public.season_teams hs ON hs.id = m.home_season_team_id
    JOIN public.season_teams aws ON aws.id = m.away_season_team_id
    WHERE v_walkover_en_retiro
      AND m.season_id = p_season_id
      AND m.knockout_round_id IS NULL
      AND (p_group_id IS NULL OR m.season_group_id = p_group_id)
      AND m.voided_at IS NOT NULL
      AND m.void_reason = 'equipo retirado'
      AND (hs.status = 'retirado' OR aws.status = 'retirado')
  ),
  all_official AS (
    SELECT * FROM official
    UNION ALL
    SELECT * FROM withdrawal_walkover ww
    WHERE ww.home_score IS NOT NULL AND ww.away_score IS NOT NULL
  ),
  results AS (
    SELECT
      o.home_season_team_id AS season_team_id,
      CASE
        WHEN o.home_score > o.away_score THEN 'W'
        WHEN o.home_score < o.away_score THEN 'L'
        ELSE 'D'
      END AS result,
      o.home_score AS gf,
      o.away_score AS ga,
      COALESCE(o.starts_at, o.created_at) AS sort_at,
      o.id AS match_id
    FROM all_official o
    UNION ALL
    SELECT
      o.away_season_team_id,
      CASE
        WHEN o.away_score > o.home_score THEN 'W'
        WHEN o.away_score < o.home_score THEN 'L'
        ELSE 'D'
      END,
      o.away_score,
      o.home_score,
      COALESCE(o.starts_at, o.created_at),
      o.id
    FROM all_official o
  ),
  agg AS (
    SELECT
      t.season_team_id,
      t.team_id,
      t.team_name,
      t.registration_status,
      COALESCE(COUNT(r.match_id), 0)::integer AS played,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0)::integer AS won,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0)::integer AS drawn,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0)::integer AS lost,
      COALESCE(SUM(r.gf), 0)::integer AS goals_for,
      COALESCE(SUM(r.ga), 0)::integer AS goals_against,
      (
        COALESCE(SUM(r.gf), 0) - COALESCE(SUM(r.ga), 0)
      )::integer AS goal_difference,
      (
        COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0) * v_points_win
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0) * v_points_draw
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0) * v_points_loss
      )::integer AS points
    FROM teams t
    LEFT JOIN results r ON r.season_team_id = t.season_team_id
    GROUP BY t.season_team_id, t.team_id, t.team_name, t.registration_status
  ),
  form_ranked AS (
    SELECT
      r.season_team_id,
      r.result,
      ROW_NUMBER() OVER (
        PARTITION BY r.season_team_id
        ORDER BY r.sort_at DESC, r.match_id DESC
      ) AS rn
    FROM results r
  ),
  form_agg AS (
    SELECT
      fr.season_team_id,
      string_agg(
        CASE fr.result
          WHEN 'W' THEN 'G'
          WHEN 'D' THEN 'E'
          ELSE 'P'
        END,
        ''
        ORDER BY fr.rn DESC
      ) AS recent_form
    FROM form_ranked fr
    WHERE fr.rn <= 5
    GROUP BY fr.season_team_id
  ),
  ranked AS (
    SELECT
      a.*,
      COALESCE(f.recent_form, '') AS recent_form,
      RANK() OVER (
        ORDER BY a.points DESC, a.goal_difference DESC, a.goals_for DESC
      )::integer AS "position"
    FROM agg a
    LEFT JOIN form_agg f ON f.season_team_id = a.season_team_id
  )
  SELECT
    r."position",
    r.season_team_id,
    r.team_id,
    r.team_name,
    r.registration_status,
    r.played,
    r.won,
    r.drawn,
    r.lost,
    r.goals_for,
    r.goals_against,
    r.goal_difference,
    r.points,
    r.recent_form
  FROM ranked r
  ORDER BY r."position" ASC, r.team_name ASC, r.season_team_id ASC;
END;
$$;

-- =============================================================================
-- 7) ai_jobs + jornada_summaries (ADR-0016)
-- =============================================================================
ALTER TABLE public.ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_tipo_check;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_tipo_check CHECK (
  tipo IN ('cronica', 'jornada_resumen')
);

CREATE TABLE public.jornada_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  content text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  ai_job_id uuid REFERENCES public.ai_jobs (id) ON DELETE SET NULL,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jornada_summaries_round_positive CHECK (round_number >= 1),
  CONSTRAINT jornada_summaries_season_round_unique UNIQUE (season_id, round_number)
);

CREATE INDEX jornada_summaries_organization_id_idx
  ON public.jornada_summaries (organization_id);
CREATE INDEX jornada_summaries_season_id_idx
  ON public.jornada_summaries (season_id);

CREATE TRIGGER jornada_summaries_set_updated_at
  BEFORE UPDATE ON public.jornada_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER jornada_summaries_enforce_org_matches_season
  BEFORE INSERT OR UPDATE ON public.jornada_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.matches_enforce_org_matches_season();

-- Fix trigger: jornada_summaries uses season_id not match season - use seasons trigger pattern
DROP TRIGGER IF EXISTS jornada_summaries_enforce_org_matches_season ON public.jornada_summaries;

CREATE OR REPLACE FUNCTION public.jornada_summaries_enforce_org_matches_season()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_org uuid;
BEGIN
  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION 'organization_id must match season organization'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER jornada_summaries_enforce_org
  BEFORE INSERT OR UPDATE ON public.jornada_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.jornada_summaries_enforce_org_matches_season();

ALTER TABLE public.jornada_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY jornada_summaries_select_member
  ON public.jornada_summaries FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY jornada_summaries_update_owner_or_admin
  ON public.jornada_summaries FOR UPDATE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.jornada_summaries FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.jornada_summaries TO authenticated;

CREATE TRIGGER audit_jornada_summaries
  AFTER INSERT OR UPDATE OR DELETE ON public.jornada_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE OR REPLACE FUNCTION public.enqueue_jornada_summary(
  p_season_id uuid,
  p_round_number integer,
  p_prompt text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_job_id uuid;
  v_prompt text := btrim(COALESCE(p_prompt, ''));
BEGIN
  IF auth.uid() IS NULL THEN
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

  IF NOT public.organization_has_premium(v_org) THEN
    RAISE EXCEPTION 'Resumen de jornada con IA requiere plan Premium'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_round_number IS NULL OR p_round_number < 1 THEN
    RAISE EXCEPTION 'Invalid round_number' USING ERRCODE = 'P0001';
  END IF;

  IF v_prompt = '' THEN
    RAISE EXCEPTION 'Prompt is required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_jobs (
    organization_id,
    app,
    tipo,
    payload,
    status,
    created_by
  ) VALUES (
    v_org,
    'ligera',
    'jornada_resumen',
    jsonb_build_object(
      'prompt', v_prompt,
      'season_id', p_season_id,
      'round_number', p_round_number
    ),
    'pending',
    auth.uid()
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_jornada_summary(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_jornada_summary(uuid, integer, text) TO authenticated;

-- =============================================================================
-- 8) Bulk create RPCs (ADR-0018)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_teams_bulk(
  p_organization_id uuid,
  p_names text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_trimmed text;
  v_team_id uuid;
  v_created uuid[] := ARRAY[]::uuid[];
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    p_organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  IF p_names IS NULL OR array_length(p_names, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one team name is required' USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_name IN ARRAY p_names LOOP
    v_trimmed := btrim(COALESCE(v_name, ''));
    IF v_trimmed = '' THEN
      CONTINUE;
    END IF;
    IF char_length(v_trimmed) < 2 OR char_length(v_trimmed) > 100 THEN
      RAISE EXCEPTION 'Team name must be between 2 and 100 characters: %', v_trimmed
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.teams (organization_id, name)
    VALUES (p_organization_id, v_trimmed)
    RETURNING id INTO v_team_id;

    v_created := array_append(v_created, v_team_id);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No valid team names provided' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('created_count', v_count, 'team_ids', to_jsonb(v_created));
END;
$$;

REVOKE ALL ON FUNCTION public.create_teams_bulk(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_teams_bulk(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_players_and_add_to_roster_bulk(
  p_season_team_id uuid,
  p_entries jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_entry jsonb;
  v_full_name text;
  v_jersey integer;
  v_created integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season team not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'entries must be a JSON array' USING ERRCODE = 'P0001';
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    v_full_name := btrim(COALESCE(v_entry->>'full_name', ''));
    IF v_full_name = '' THEN
      CONTINUE;
    END IF;

    v_jersey := NULL;
    IF v_entry ? 'jersey_number' AND v_entry->>'jersey_number' IS NOT NULL THEN
      v_jersey := (v_entry->>'jersey_number')::integer;
    END IF;

    PERFORM public.create_player_and_add_to_roster(
      p_season_team_id,
      v_full_name,
      v_jersey,
      'active'
    );
    v_created := v_created + 1;
  END LOOP;

  IF v_created = 0 THEN
    RAISE EXCEPTION 'No valid player entries provided' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('created_count', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.create_players_and_add_to_roster_bulk(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_players_and_add_to_roster_bulk(uuid, jsonb)
  TO authenticated;
