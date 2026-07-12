-- Migration 008b: harden season_roles and capture permissions
-- Applied after 20260712230305_create_season_roles_and_capture.sql
--
-- Idempotent on ligapro-dev (hardening was previously applied manually via
-- supabase/tests/_apply_008_hardening.sql). Fresh installs get the same end
-- state by running 008 then this migration.

-- ---------------------------------------------------------------------------
-- 1. Drop additive UPDATE policies (INSERT-only capture for non-admins)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS match_events_update_tournament_admin ON public.match_events;
DROP POLICY IF EXISTS match_events_update_confirmed_official ON public.match_events;

-- ---------------------------------------------------------------------------
-- 2. has_season_role requires CURRENT organization_members membership
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
    INNER JOIN public.organization_members om
      ON om.organization_id = sr.organization_id
     AND om.profile_id = auth.uid()
    WHERE sr.season_id = p_season_id
      AND sr.profile_id = auth.uid()
      AND sr.role = ANY (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Composite FK: season_roles → organization_members ON DELETE CASCADE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'season_roles_organization_member_fkey'
      AND conrelid = 'public.season_roles'::regclass
  ) THEN
    ALTER TABLE public.season_roles
      ADD CONSTRAINT season_roles_organization_member_fkey
      FOREIGN KEY (organization_id, profile_id)
      REFERENCES public.organization_members (organization_id, profile_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reaffirm grants (idempotent; same as Migration 008)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_season_role(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_capture_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_match_result(uuid, text, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_season_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_capture_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_match_result(uuid, text, integer, integer) TO authenticated;

COMMENT ON TABLE public.season_roles IS
  'Per-season roles for capture. Membership must remain current (FK CASCADE + has_season_role JOIN). Officials also require match_officials confirmed. Capture is INSERT-only for tournament_admin/referee/delegate.';
