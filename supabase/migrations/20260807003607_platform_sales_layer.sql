-- Migration: capa de vendedores (ADR-0013, punto 6)
-- Sigue el mismo patrón que platform_staff_billing (027): tabla poblada
-- manualmente, sin RPC de alta/baja, autorización vía is_platform_staff.

-- ---------------------------------------------------------------------------
-- 1. Rol dentro de platform_staff
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_staff
  ADD COLUMN role text NOT NULL DEFAULT 'platform_owner';

ALTER TABLE public.platform_staff
  ADD CONSTRAINT platform_staff_role_check
  CHECK (role IN ('platform_owner', 'vendor'));

COMMENT ON COLUMN public.platform_staff.role IS
  'platform_owner ve todo cross-org. vendor solo ve organizations con sold_by_platform_staff_id = su propio id. Se asigna manualmente en Supabase, igual que el resto de platform_staff.';

-- ---------------------------------------------------------------------------
-- 2. Atribución de venta en organizations
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN sold_by_platform_staff_id uuid REFERENCES public.platform_staff(id);

COMMENT ON COLUMN public.organizations.sold_by_platform_staff_id IS
  'Qué platform_staff (vendedor) cerró este cliente. NULL = sin atribuir / cerrado directo por platform_owner. Se asigna manualmente por ahora, igual que platform_staff.';

-- ---------------------------------------------------------------------------
-- 3. is_platform_vendor helper (mismo patrón que is_platform_staff)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_own_platform_staff_role(p_profile_id uuid)
RETURNS TABLE (staff_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.id, ps.role
  FROM public.platform_staff ps
  WHERE ps.profile_id = p_profile_id;
$$;

REVOKE ALL ON FUNCTION public.get_own_platform_staff_role(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_platform_sales_overview — platform staff only
-- platform_owner ve todas las organizaciones con su vendedor atribuido.
-- vendor ve únicamente las suyas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_platform_sales_overview()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  sold_by_staff_id uuid,
  sold_by_display_name text,
  active_season_count bigint,
  member_count bigint,
  organization_created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT staff_id, role INTO v_staff_id, v_role
  FROM public.get_own_platform_staff_role(auth.uid());

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized: platform staff only'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    o.sold_by_platform_staff_id AS sold_by_staff_id,
    seller_profile.display_name AS sold_by_display_name,
    (
      SELECT COUNT(*)::bigint
      FROM public.seasons s
      WHERE s.organization_id = o.id
        AND s.visibility <> 'archived'
    ) AS active_season_count,
    (
      SELECT COUNT(*)::bigint
      FROM public.organization_members om
      WHERE om.organization_id = o.id
    ) AS member_count,
    o.created_at AS organization_created_at
  FROM public.organizations o
  LEFT JOIN public.platform_staff seller ON seller.id = o.sold_by_platform_staff_id
  LEFT JOIN public.profiles seller_profile ON seller_profile.id = seller.profile_id
  WHERE
    v_role = 'platform_owner'
    OR o.sold_by_platform_staff_id = v_staff_id
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_sales_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_sales_overview() TO authenticated;

COMMENT ON FUNCTION public.get_platform_sales_overview() IS
  'Platform staff only. platform_owner ve todas las organizaciones; vendor solo las que tiene atribuidas via sold_by_platform_staff_id. Sin datos operativos de cliente (roster/finanzas/disciplina).';
