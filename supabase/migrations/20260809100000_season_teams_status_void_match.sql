-- Migration 030: plan tier, season team status, void match, jornada summaries
-- ADRs: 0015, 0016, 0017

-- =============================================================================
-- 1) organizations.plan_tier
-- =============================================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'basico';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_tier_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_tier_check CHECK (
    plan_tier IN ('basico', 'premium')
  );

COMMENT ON COLUMN public.organizations.plan_tier IS
  'Product plan: basico | premium. Writable only via set_organization_plan_tier (platform staff).';

-- =============================================================================
-- 2) organization_has_premium / set_organization_plan_tier
-- =============================================================================
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

COMMENT ON FUNCTION public.organization_has_premium(uuid) IS
  'Single source of truth for Premium access checks in backend RPCs.';

CREATE OR REPLACE FUNCTION public.set_organization_plan_tier(
  p_organization_id uuid,
  p_plan_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only'
      USING ERRCODE = 'P0001';
  END IF;

  v_tier := NULLIF(btrim(COALESCE(p_plan_tier, '')), '');
  IF v_tier IS NULL OR v_tier NOT IN ('basico', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan_tier'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organizations
  SET plan_tier = v_tier
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_organization_plan_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_organization_plan_tier(uuid, text) TO authenticated;

-- Extend billing overview with org id + plan tier
CREATE OR REPLACE FUNCTION public.get_platform_billing_overview()
RETURNS TABLE (
  season_id uuid,
  organization_id uuid,
  organization_name text,
  plan_tier text,
  season_name text,
  platform_billing_status text,
  enrolled_team_count bigint,
  has_fixture boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS season_id,
    o.id AS organization_id,
    o.name AS organization_name,
    o.plan_tier,
    s.name AS season_name,
    s.platform_billing_status,
    (
      SELECT COUNT(*)::bigint
      FROM public.season_teams st
      WHERE st.season_id = s.id
        AND st.registration_status IN ('registered', 'confirmed')
    ) AS enrolled_team_count,
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.season_id = s.id
    ) AS has_fixture
  FROM public.seasons s
  JOIN public.organizations o ON o.id = s.organization_id
  ORDER BY o.name ASC, s.name ASC;
END;
$$;

-- =============================================================================
-- 3) season_rules: walkover on withdrawal + enrollment deadline
-- =============================================================================
ALTER TABLE public.season_rules
  ADD COLUMN IF NOT EXISTS walkover_en_retiro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walkover_retiro_winner_goals integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS walkover_retiro_loser_goals integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_limite_inscripcion date;

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_walkover_retiro_goals_check;

ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_walkover_retiro_goals_check CHECK (
    walkover_retiro_winner_goals >= 0
    AND walkover_retiro_loser_goals >= 0
  );

COMMENT ON COLUMN public.season_rules.walkover_en_retiro IS
  'When true, scheduled matches vs a retirado team become walkover for the opponent.';
COMMENT ON COLUMN public.season_rules.fecha_limite_inscripcion IS
  'Optional last date for new team enrollments via enroll_team_in_season.';

-- =============================================================================
-- 4) season_teams.status
-- =============================================================================
ALTER TABLE public.season_teams
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS status_effective_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.season_teams
  DROP CONSTRAINT IF EXISTS season_teams_status_check;

ALTER TABLE public.season_teams
  ADD CONSTRAINT season_teams_status_check CHECK (
    status IN ('activo', 'retirado', 'suspendido')
  );

UPDATE public.season_teams
SET status_effective_at = created_at
WHERE status_effective_at IS NULL;

COMMENT ON COLUMN public.season_teams.status IS
  'Operational status: activo | retirado | suspendido. Changed via set_season_team_status RPC.';

-- =============================================================================
-- 5) matches void columns
-- =============================================================================
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by_profile_id uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_void_all_or_none_check;

ALTER TABLE public.matches
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

COMMENT ON COLUMN public.matches.voided_at IS
  'Set when match is voided (e.g. equipo retirado). Void via void_match RPC only.';

-- =============================================================================
-- 6) void_match RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.void_match(
  p_match_id uuid,
  p_reason text,
  p_outcome_status text DEFAULT 'cancelled',
  p_home_score integer DEFAULT NULL,
  p_away_score integer DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.matches;
  v_reason text;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_outcome_status), ''), 'cancelled');
  IF v_status NOT IN ('cancelled', 'walkover') THEN
    RAISE EXCEPTION 'Invalid outcome status for void_match'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(v_row.season_id);

  IF NOT public.has_role_in_org_scoped(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[],
    'season',
    v_row.season_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to void match %', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Match % is already voided', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled matches can be voided'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'walkover' THEN
    IF p_home_score IS NULL OR p_away_score IS NULL THEN
      RAISE EXCEPTION 'Walkover void requires home and away scores'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM set_config('app.match_void', 'true', true);

  UPDATE public.matches
  SET
    status = v_status,
    home_score = CASE WHEN v_status = 'walkover' THEN p_home_score ELSE NULL END,
    away_score = CASE WHEN v_status = 'walkover' THEN p_away_score ELSE NULL END,
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason
  WHERE id = p_match_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.void_match(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_match(uuid, text, text, integer, integer) TO authenticated;

-- =============================================================================
-- 7) set_season_team_status RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_season_team_status(
  p_season_team_id uuid,
  p_status text,
  p_reason text
)
RETURNS public.season_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.season_teams;
  v_status text;
  v_reason text;
  v_match record;
  v_rules record;
  v_winner_is_home boolean;
  v_home_score integer;
  v_away_score integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := NULLIF(btrim(COALESCE(p_status, '')), '');
  IF v_status IS NULL OR v_status NOT IN ('activo', 'retirado', 'suspendido') THEN
    RAISE EXCEPTION 'Invalid status'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(v_row.season_id);

  IF NOT public.has_role_in_org_scoped(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[],
    'season',
    v_row.season_id
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_teams
  SET
    status = v_status,
    status_effective_at = now()
  WHERE id = p_season_team_id
  RETURNING * INTO v_row;

  IF v_status = 'retirado' THEN
    SELECT
      sr.walkover_en_retiro,
      sr.walkover_retiro_winner_goals,
      sr.walkover_retiro_loser_goals
    INTO v_rules
    FROM public.season_rules sr
    WHERE sr.season_id = v_row.season_id;

    FOR v_match IN
      SELECT m.id, m.home_season_team_id, m.away_season_team_id
      FROM public.matches m
      WHERE m.season_id = v_row.season_id
        AND m.status = 'scheduled'
        AND m.voided_at IS NULL
        AND (
          m.home_season_team_id = p_season_team_id
          OR m.away_season_team_id = p_season_team_id
        )
    LOOP
      IF COALESCE(v_rules.walkover_en_retiro, false) THEN
        v_winner_is_home := v_match.home_season_team_id <> p_season_team_id;
        IF v_winner_is_home THEN
          v_home_score := v_rules.walkover_retiro_winner_goals;
          v_away_score := v_rules.walkover_retiro_loser_goals;
        ELSE
          v_home_score := v_rules.walkover_retiro_loser_goals;
          v_away_score := v_rules.walkover_retiro_winner_goals;
        END IF;

        PERFORM public.void_match(
          v_match.id,
          'equipo retirado',
          'walkover',
          v_home_score,
          v_away_score
        );
      ELSE
        PERFORM public.void_match(
          v_match.id,
          'equipo retirado',
          'cancelled',
          NULL,
          NULL
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_season_team_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_team_status(uuid, text, text) TO authenticated;

-- =============================================================================
-- 8) enroll_team_in_season — enrollment deadline check
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
  v_registration_fee numeric(12, 2);
  v_fecha_limite date;
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

  SELECT sr.fecha_limite_inscripcion INTO v_fecha_limite
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_fecha_limite IS NOT NULL AND CURRENT_DATE > v_fecha_limite THEN
    RAISE EXCEPTION
      'Inscripciones cerradas: la fecha límite fue el %',
      to_char(v_fecha_limite, 'YYYY-MM-DD')
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

-- =============================================================================
-- 9) update_season_with_rules — new rule fields
-- =============================================================================
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
  p_suspension_matches integer,
  p_walkover_en_retiro boolean DEFAULT NULL,
  p_walkover_retiro_winner_goals integer DEFAULT NULL,
  p_walkover_retiro_loser_goals integer DEFAULT NULL,
  p_fecha_limite_inscripcion date DEFAULT NULL
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
    'round_robin', 'round_robin_double', 'groups_knockout', 'knockout'
  ) THEN
    RAISE EXCEPTION 'Invalid format_type'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN (
    'draft', 'private', 'unlisted', 'public', 'archived'
  ) THEN
    RAISE EXCEPTION 'Invalid visibility'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_starts_on IS NOT NULL AND p_ends_on IS NOT NULL AND p_ends_on < p_starts_on THEN
    RAISE EXCEPTION 'ends_on must be on or after starts_on'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_points_win IS NULL OR p_points_draw IS NULL OR p_points_loss IS NULL
     OR p_allow_draws IS NULL OR p_match_duration_minutes IS NULL
     OR p_minimum_rest_minutes IS NULL OR p_yellow_card_limit IS NULL
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

  UPDATE public.season_rules
  SET
    points_win = p_points_win,
    points_draw = p_points_draw,
    points_loss = p_points_loss,
    allow_draws = p_allow_draws,
    match_duration_minutes = p_match_duration_minutes,
    minimum_rest_minutes = p_minimum_rest_minutes,
    yellow_card_limit = p_yellow_card_limit,
    suspension_matches = p_suspension_matches,
    walkover_en_retiro = COALESCE(p_walkover_en_retiro, walkover_en_retiro),
    walkover_retiro_winner_goals = COALESCE(
      p_walkover_retiro_winner_goals,
      walkover_retiro_winner_goals
    ),
    walkover_retiro_loser_goals = COALESCE(
      p_walkover_retiro_loser_goals,
      walkover_retiro_loser_goals
    ),
    fecha_limite_inscripcion = p_fecha_limite_inscripcion
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
  integer, integer, integer, boolean, integer, integer, integer, integer,
  boolean, integer, integer, date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_season_with_rules(
  uuid, text, text, text, date, date,
  integer, integer, integer, boolean, integer, integer, integer, integer,
  boolean, integer, integer, date
) TO authenticated;

-- =============================================================================
-- 10) ai_jobs: allow resumen_jornada tipo
-- =============================================================================
ALTER TABLE public.ai_jobs
  DROP CONSTRAINT IF EXISTS ai_jobs_tipo_check;

ALTER TABLE public.ai_jobs
  ADD CONSTRAINT ai_jobs_tipo_check CHECK (
    tipo IN ('cronica', 'resumen_jornada')
  );

-- =============================================================================
-- 11) jornada_summaries
-- =============================================================================
CREATE TABLE public.jornada_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  round_label text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jornada_summaries_season_round_unique UNIQUE (season_id, round_label)
);

CREATE INDEX jornada_summaries_organization_id_idx
  ON public.jornada_summaries (organization_id);
CREATE INDEX jornada_summaries_season_id_idx
  ON public.jornada_summaries (season_id);

CREATE TRIGGER jornada_summaries_set_updated_at
  BEFORE UPDATE ON public.jornada_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

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
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION 'organization_id must match season organization';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER jornada_summaries_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF season_id, organization_id
  ON public.jornada_summaries
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

-- =============================================================================
-- 12) bulk_create_teams / bulk_create_players_and_add_to_roster
-- =============================================================================
CREATE OR REPLACE FUNCTION public.bulk_create_teams(
  p_organization_id uuid,
  p_names text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    p_organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_names IS NULL OR array_length(p_names, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_name IN ARRAY p_names LOOP
    v_name := btrim(COALESCE(v_name, ''));
    IF char_length(v_name) >= 2 AND char_length(v_name) <= 100 THEN
      INSERT INTO public.teams (organization_id, name)
      VALUES (p_organization_id, v_name);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_create_teams(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_create_teams(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_create_players_and_add_to_roster(
  p_season_team_id uuid,
  p_names text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_name IN ARRAY p_names LOOP
    v_name := btrim(COALESCE(v_name, ''));
    IF char_length(v_name) >= 2 AND char_length(v_name) <= 120 THEN
      PERFORM public.create_player_and_add_to_roster(
        p_season_team_id,
        v_name,
        NULL,
        'active'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_create_players_and_add_to_roster(uuid, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_create_players_and_add_to_roster(uuid, text[])
  TO authenticated;
