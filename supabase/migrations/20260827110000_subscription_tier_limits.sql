-- Operational subscription tiers (Básico / Pro / Premium) + manual addon overrides.
-- Distinct from organizations.plan_tier (commercial feature gate, ADR-0017).

ALTER TABLE public.organizations
  ADD COLUMN subscription_tier text NOT NULL DEFAULT 'basico',
  ADD COLUMN addon_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_tier_check CHECK (
    subscription_tier IN ('basico', 'pro', 'premium')
  );

COMMENT ON COLUMN public.organizations.subscription_tier IS
  'Operational limits tier. Writable only via set_organization_subscription_tier (platform staff).';

COMMENT ON COLUMN public.organizations.addon_overrides IS
  'Manual addon limits applied on top of subscription_tier base limits (platform staff).';

CREATE OR REPLACE FUNCTION public.set_organization_subscription_tier(
  p_organization_id uuid,
  p_subscription_tier text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.organizations;
  v_tier text := btrim(COALESCE(p_subscription_tier, ''));
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

  IF v_tier NOT IN ('basico', 'pro', 'premium') THEN
    RAISE EXCEPTION 'Invalid subscription_tier' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organizations
  SET subscription_tier = v_tier, updated_at = now()
  WHERE id = p_organization_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_organization_subscription_tier(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_organization_subscription_tier(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_organization_addon_overrides(
  p_organization_id uuid,
  p_addon_overrides jsonb
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.organizations;
  v_overrides jsonb := COALESCE(p_addon_overrides, '{}'::jsonb);
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

  IF jsonb_typeof(v_overrides) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'addon_overrides must be a JSON object' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organizations
  SET addon_overrides = v_overrides, updated_at = now()
  WHERE id = p_organization_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_organization_addon_overrides(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_organization_addon_overrides(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_organizations_subscription_limits()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  subscription_tier text,
  addon_overrides jsonb,
  active_competitions bigint,
  active_venues bigint,
  active_fields bigint,
  staff_users bigint,
  chronicles_this_month bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  v_month_start := (
    date_trunc(
      'month',
      now() AT TIME ZONE 'America/Mexico_City'
    ) AT TIME ZONE 'America/Mexico_City'
  );

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.subscription_tier,
    o.addon_overrides,
    (
      SELECT COUNT(DISTINCT c.id)::bigint
      FROM public.competitions c
      WHERE c.organization_id = o.id
        AND EXISTS (
          SELECT 1
          FROM public.seasons s
          WHERE s.competition_id = c.id
            AND s.visibility <> 'archived'
        )
    ) AS active_competitions,
    (
      SELECT COUNT(*)::bigint
      FROM public.venues v
      WHERE v.organization_id = o.id
        AND v.is_active = true
    ) AS active_venues,
    (
      SELECT COUNT(*)::bigint
      FROM public.fields f
      JOIN public.venues v ON v.id = f.venue_id
      WHERE f.organization_id = o.id
        AND f.is_active = true
        AND v.is_active = true
    ) AS active_fields,
    (
      SELECT COUNT(*)::bigint
      FROM public.organization_members om
      WHERE om.organization_id = o.id
        AND om.role IN ('organization_owner', 'organization_admin')
    ) AS staff_users,
    (
      SELECT COUNT(*)::bigint
      FROM public.ai_jobs aj
      WHERE aj.organization_id = o.id
        AND aj.tipo = 'cronica'
        AND aj.created_at >= v_month_start
    ) AS chronicles_this_month
  FROM public.organizations o
  ORDER BY o.name ASC, o.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_organizations_subscription_limits()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_organizations_subscription_limits()
  TO authenticated;
