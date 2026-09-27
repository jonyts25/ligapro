-- Match result review window (24h), captain disputes, admin/cron approval.

-- =============================================================================
-- 1) matches: review columns
-- =============================================================================
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS result_review_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_review_auto_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_approved_by_profile_id uuid
    REFERENCES public.profiles(id);

COMMENT ON COLUMN public.matches.result_review_opened_at IS
  'When the current result review window opened (finished/walkover).';
COMMENT ON COLUMN public.matches.result_review_auto_close_at IS
  'When the result auto-approves if no open dispute exists.';
COMMENT ON COLUMN public.matches.result_approved_at IS
  'When the match result became official (manual or auto).';

-- =============================================================================
-- 2) match_result_disputes
-- =============================================================================
CREATE TABLE public.match_result_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_team_id uuid NOT NULL REFERENCES public.season_teams(id),
  opened_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  resolved_by_profile_id uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_result_disputes_reason_not_blank CHECK (length(trim(reason)) > 0)
);

CREATE UNIQUE INDEX match_result_disputes_one_open_per_match_idx
  ON public.match_result_disputes (match_id)
  WHERE status = 'open';

CREATE INDEX match_result_disputes_match_id_idx
  ON public.match_result_disputes (match_id);
CREATE INDEX match_result_disputes_organization_id_idx
  ON public.match_result_disputes (organization_id);

CREATE TRIGGER match_result_disputes_set_updated_at
  BEFORE UPDATE ON public.match_result_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.match_result_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_result_disputes_select_member
  ON public.match_result_disputes FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

REVOKE ALL ON TABLE public.match_result_disputes FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.match_result_disputes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.match_result_disputes TO authenticated;

CREATE TRIGGER audit_match_result_disputes
  AFTER INSERT OR UPDATE OR DELETE ON public.match_result_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

COMMENT ON TABLE public.match_result_disputes IS
  'Captain disputes during the 24h result review window. Writes via RPC only.';

-- =============================================================================
-- 3) update_match_result — extend close path with review window
-- =============================================================================
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

-- =============================================================================
-- 4) open_match_result_dispute
-- =============================================================================
CREATE OR REPLACE FUNCTION public.open_match_result_dispute(
  p_match_id uuid,
  p_reason text
)
RETURNS public.match_result_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_captain_team uuid;
  v_dispute public.match_result_disputes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Dispute reason cannot be empty' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_member_of(v_match.organization_id) THEN
    RAISE EXCEPTION 'Not authorized to dispute match result' USING ERRCODE = 'P0001';
  END IF;

  IF v_match.status NOT IN ('finished', 'walkover') THEN
    RAISE EXCEPTION
      'Can only dispute a finished or walkover match result'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_match.result_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Match result is already approved' USING ERRCODE = 'P0001';
  END IF;

  v_captain_team := public.__captain_season_team_for_match(p_match_id, auth.uid());
  IF v_captain_team IS NULL THEN
    RAISE EXCEPTION
      'Only a captain of one of the match teams can open a dispute'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.match_result_disputes d
    WHERE d.match_id = p_match_id
      AND d.status = 'open'
  ) THEN
    RAISE EXCEPTION
      'Ya hay una disputa abierta para este partido'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.match_result_disputes (
    match_id,
    organization_id,
    season_team_id,
    opened_by_profile_id,
    reason,
    status
  ) VALUES (
    p_match_id,
    v_match.organization_id,
    v_captain_team,
    auth.uid(),
    trim(p_reason),
    'open'
  )
  RETURNING * INTO v_dispute;

  RETURN v_dispute;
END;
$$;

REVOKE ALL ON FUNCTION public.open_match_result_dispute(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_match_result_dispute(uuid, text)
  TO authenticated;

-- =============================================================================
-- 5) approve_match_result
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_match_result(p_match_id uuid)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_is_privileged boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id USING ERRCODE = 'P0001';
  END IF;

  v_is_privileged := (
    public.has_role_in_org(
      v_match.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(v_match.season_id, ARRAY['tournament_admin']::text[])
  );

  IF NOT v_is_privileged THEN
    RAISE EXCEPTION
      'Not authorized to approve match result for match %',
      p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_match.status NOT IN ('finished', 'walkover') THEN
    RAISE EXCEPTION
      'Can only approve finished or walkover match results'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_match.result_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Match result is already approved' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.matches
  SET
    result_approved_at = now(),
    result_approved_by_profile_id = auth.uid(),
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  UPDATE public.match_result_disputes
  SET
    status = 'resolved',
    resolved_at = now(),
    resolved_by_profile_id = auth.uid(),
    updated_at = now()
  WHERE match_id = p_match_id
    AND status = 'open';

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_match_result(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_match_result(uuid)
  TO authenticated;

-- =============================================================================
-- 6) auto_close_pending_match_results (pg_cron only — no auth.uid())
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_close_pending_match_results()
RETURNS TABLE(match_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH approved AS (
    UPDATE public.matches m
    SET
      result_approved_at = now(),
      result_approved_by_profile_id = NULL,
      updated_at = now()
    WHERE m.status IN ('finished', 'walkover')
      AND m.result_approved_at IS NULL
      AND m.result_review_auto_close_at IS NOT NULL
      AND m.result_review_auto_close_at <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.match_result_disputes d
        WHERE d.match_id = m.id
          AND d.status = 'open'
      )
    RETURNING m.id
  )
  SELECT approved.id FROM approved;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_close_pending_match_results()
  FROM PUBLIC, anon, authenticated;
-- pg_cron runs as database superuser; no GRANT to authenticated.

COMMENT ON FUNCTION public.auto_close_pending_match_results() IS
  'Auto-approves match results past result_review_auto_close_at without open disputes. Intended for pg_cron only.';

-- =============================================================================
-- 7) pg_cron extension + job (Claude applies manually if permissions fail)
-- =============================================================================
-- Requires superuser / dashboard: CREATE EXTENSION pg_cron.
-- Cursor does not apply this block to Supabase.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname = 'auto-close-match-results';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-close-match-results',
  '*/15 * * * *',
  $$SELECT public.auto_close_pending_match_results();$$
);
