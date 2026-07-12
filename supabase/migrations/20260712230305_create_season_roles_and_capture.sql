-- Migration 008: season_roles and controlled capture permissions
-- Additive only: organization_owner/admin policies unchanged.
-- No changes to discipline_suspensions logic or match_officials assignment scope.

-- ---------------------------------------------------------------------------
-- season_roles
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_roles_role_check CHECK (
    role IN ('tournament_admin', 'referee', 'delegate')
  ),
  CONSTRAINT season_roles_season_profile_role_unique
    UNIQUE (season_id, profile_id, role)
);

CREATE INDEX season_roles_season_id_idx ON public.season_roles (season_id);
CREATE INDEX season_roles_organization_id_idx ON public.season_roles (organization_id);
CREATE INDEX season_roles_profile_id_idx ON public.season_roles (profile_id);
CREATE INDEX season_roles_season_profile_role_idx
  ON public.season_roles (season_id, profile_id, role);

CREATE TRIGGER season_roles_set_updated_at
  BEFORE UPDATE ON public.season_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.season_roles_enforce_org_matches_season()
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
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION
      'season_roles.organization_id (%) must match seasons.organization_id (%) for season %',
      NEW.organization_id,
      v_season_org,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_roles_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF season_id, organization_id
  ON public.season_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.season_roles_enforce_org_matches_season();

CREATE OR REPLACE FUNCTION public.season_roles_enforce_org_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = NEW.organization_id
      AND m.profile_id = NEW.profile_id
  ) THEN
    RAISE EXCEPTION
      'profile % must be an organization_members row for organization % before receiving a season_role',
      NEW.profile_id,
      NEW.organization_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_roles_enforce_org_membership
  BEFORE INSERT OR UPDATE OF organization_id, profile_id
  ON public.season_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.season_roles_enforce_org_membership();

COMMENT ON TABLE public.season_roles IS
  'Per-season roles for capture. Season eligibility alone is not enough for officials — match_officials confirmed assignment required.';

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- SECURITY DEFINER: same rationale as is_member_of / has_role_in_org — avoids
-- RLS recursion when season_roles policies are evaluated from other tables.
-- Uses auth.uid() only; no external profile_id parameter (no impersonation).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_season_role(p_season_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.season_roles sr
    WHERE sr.season_id = p_season_id
      AND sr.profile_id = auth.uid()
      AND sr.role = ANY (p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_capture_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        public.has_role_in_org(
          m.organization_id,
          ARRAY['organization_owner', 'organization_admin']::text[]
        )
        OR public.has_season_role(m.season_id, ARRAY['tournament_admin']::text[])
        OR (
          public.has_season_role(m.season_id, ARRAY['referee', 'delegate']::text[])
          AND EXISTS (
            SELECT 1
            FROM public.match_officials mo
            WHERE mo.match_id = m.id
              AND mo.profile_id = auth.uid()
              AND mo.status = 'confirmed'
              AND mo.role IN ('referee', 'delegate')
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Secure RPC: tournament_admin (and org owner/admin) update score/status only
-- Referee/delegate explicitly rejected here.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- match_events integrity: prevent reparenting on UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_events_prevent_reparent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.match_id IS DISTINCT FROM OLD.match_id THEN
    RAISE EXCEPTION
      'match_events.match_id cannot be changed (was %, attempted %)',
      OLD.match_id,
      NEW.match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION
      'match_events.organization_id cannot be changed (was %, attempted %)',
      OLD.organization_id,
      NEW.organization_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_events_prevent_reparent
  BEFORE UPDATE OF match_id, organization_id
  ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.match_events_prevent_reparent();

-- ---------------------------------------------------------------------------
-- RLS: season_roles
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_roles_select_member
  ON public.season_roles FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY season_roles_insert_owner_or_admin
  ON public.season_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY season_roles_update_owner_or_admin
  ON public.season_roles FOR UPDATE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  )
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY season_roles_delete_owner_or_admin
  ON public.season_roles FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.season_roles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.season_roles TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: additive match_events capture policies (owner/admin unchanged)
-- DELETE remains owner/admin only.
-- ---------------------------------------------------------------------------
CREATE POLICY match_events_insert_tournament_admin
  ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_id
        AND m.organization_id = organization_id
        AND public.has_season_role(m.season_id, ARRAY['tournament_admin']::text[])
    )
  );

CREATE POLICY match_events_update_tournament_admin
  ON public.match_events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.has_season_role(m.season_id, ARRAY['tournament_admin']::text[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.has_season_role(m.season_id, ARRAY['tournament_admin']::text[])
    )
  );

CREATE POLICY match_events_insert_confirmed_official
  ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_id
        AND m.organization_id = organization_id
        AND public.has_season_role(m.season_id, ARRAY['referee', 'delegate']::text[])
    )
    AND EXISTS (
      SELECT 1
      FROM public.match_officials mo
      WHERE mo.match_id = match_events.match_id
        AND mo.profile_id = auth.uid()
        AND mo.status = 'confirmed'
        AND mo.role IN ('referee', 'delegate')
    )
  );

CREATE POLICY match_events_update_confirmed_official
  ON public.match_events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.has_season_role(m.season_id, ARRAY['referee', 'delegate']::text[])
    )
    AND EXISTS (
      SELECT 1
      FROM public.match_officials mo
      WHERE mo.match_id = match_events.match_id
        AND mo.profile_id = auth.uid()
        AND mo.status = 'confirmed'
        AND mo.role IN ('referee', 'delegate')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.has_season_role(m.season_id, ARRAY['referee', 'delegate']::text[])
    )
    AND EXISTS (
      SELECT 1
      FROM public.match_officials mo
      WHERE mo.match_id = match_events.match_id
        AND mo.profile_id = auth.uid()
        AND mo.status = 'confirmed'
        AND mo.role IN ('referee', 'delegate')
    )
  );

-- Function grants
REVOKE ALL ON FUNCTION public.has_season_role(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_capture_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_match_result(uuid, text, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_season_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_capture_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_match_result(uuid, text, integer, integer) TO authenticated;
