-- Migration 027: platform staff + billing panel RPCs
-- ADR: docs/ADR/0012-staff-plataforma-facturacion.md

-- ---------------------------------------------------------------------------
-- 1. platform_staff (manual population only — no client access)
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by_profile_id uuid REFERENCES public.profiles(id)
);

COMMENT ON TABLE public.platform_staff IS
  'LigaPro platform operators. Populated manually in Supabase — no app UI or RPC.';

ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_staff FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. is_platform_staff helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_staff(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_staff ps
    WHERE ps.profile_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_platform_staff(uuid) IS
  'Returns true when profile_id is in platform_staff. Used by billing RPCs and server gate.';

-- ---------------------------------------------------------------------------
-- 3. Trigger bypass for set_platform_billing_status (Migration 021)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seasons_prevent_platform_billing_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.platform_billing_status_rpc', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.platform_billing_status IS DISTINCT FROM OLD.platform_billing_status
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION
      'platform_billing_status cannot be changed through the application'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. set_platform_billing_status — platform staff only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_platform_billing_status(
  p_season_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := btrim(COALESCE(p_status, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('pendiente', 'pagado', 'vencido') THEN
    RAISE EXCEPTION
      'Invalid platform_billing_status: %. Allowed: pendiente, pagado, vencido',
      v_status
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.platform_billing_status_rpc', 'true', true);

  UPDATE public.seasons
  SET platform_billing_status = v_status
  WHERE id = p_season_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_billing_status(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_platform_billing_status(uuid, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.set_platform_billing_status(uuid, text, text) IS
  'Platform staff only. Updates seasons.platform_billing_status via controlled bypass of Migration 021 trigger. p_reason reserved for future audit — not persisted in 027.';

-- ---------------------------------------------------------------------------
-- 5. get_platform_billing_overview — platform staff only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_platform_billing_overview()
RETURNS TABLE (
  season_id uuid,
  organization_name text,
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
    o.name AS organization_name,
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

REVOKE ALL ON FUNCTION public.get_platform_billing_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_billing_overview() TO authenticated;

COMMENT ON FUNCTION public.get_platform_billing_overview() IS
  'Platform staff only. Minimal cross-org billing snapshot — no operational org data.';

COMMENT ON COLUMN public.seasons.platform_billing_status IS
  'LigaPro platform billing gate. Writable only via set_platform_billing_status (platform staff).';
