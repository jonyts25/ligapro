-- Cotizador v3: base price per tournament (platform_pricing_defaults)

ALTER TABLE public.platform_pricing_defaults
  ADD COLUMN IF NOT EXISTS base_price_per_tournament numeric NOT NULL DEFAULT 1500
    CHECK (base_price_per_tournament >= 0);

COMMENT ON COLUMN public.platform_pricing_defaults.base_price_per_tournament IS
  'Base platform fee per tournament (season) for internal cotizador. Staff RPCs only.';

CREATE OR REPLACE FUNCTION public.get_platform_pricing_defaults()
RETURNS TABLE (
  base_price_per_tournament numeric,
  base_price_per_team numeric,
  duration_multiplier_hasta_3 numeric,
  duration_multiplier_4_to_6 numeric,
  duration_multiplier_7_to_12 numeric,
  volume_multiplier_1_to_2 numeric,
  volume_multiplier_3_to_5 numeric,
  volume_multiplier_6_plus numeric,
  updated_at timestamptz,
  updated_by_profile_id uuid
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
    COALESCE(d.base_price_per_tournament, 1500::numeric),
    COALESCE(d.base_price_per_team, 200::numeric),
    COALESCE(d.duration_multiplier_hasta_3, 1.0::numeric),
    COALESCE(d.duration_multiplier_4_to_6, 1.6::numeric),
    COALESCE(d.duration_multiplier_7_to_12, 2.6::numeric),
    COALESCE(d.volume_multiplier_1_to_2, 1.0::numeric),
    COALESCE(d.volume_multiplier_3_to_5, 0.9::numeric),
    COALESCE(d.volume_multiplier_6_plus, 0.8::numeric),
    d.updated_at,
    d.updated_by_profile_id
  FROM (VALUES (1)) AS singleton(id)
  LEFT JOIN public.platform_pricing_defaults d ON d.id = singleton.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_platform_pricing_defaults(
  p_base_price_per_tournament numeric,
  p_base_price_per_team numeric,
  p_duration_multiplier_hasta_3 numeric,
  p_duration_multiplier_4_to_6 numeric,
  p_duration_multiplier_7_to_12 numeric,
  p_volume_multiplier_1_to_2 numeric,
  p_volume_multiplier_3_to_5 numeric,
  p_volume_multiplier_6_plus numeric
)
RETURNS void
LANGUAGE plpgsql
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

  IF p_base_price_per_tournament < 0
     OR p_base_price_per_team < 0
     OR p_duration_multiplier_hasta_3 < 0
     OR p_duration_multiplier_4_to_6 < 0
     OR p_duration_multiplier_7_to_12 < 0
     OR p_volume_multiplier_1_to_2 < 0
     OR p_volume_multiplier_3_to_5 < 0
     OR p_volume_multiplier_6_plus < 0 THEN
    RAISE EXCEPTION 'Pricing values must be non-negative'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.platform_pricing_defaults (
    id,
    base_price_per_tournament,
    base_price_per_team,
    duration_multiplier_hasta_3,
    duration_multiplier_4_to_6,
    duration_multiplier_7_to_12,
    volume_multiplier_1_to_2,
    volume_multiplier_3_to_5,
    volume_multiplier_6_plus,
    updated_at,
    updated_by_profile_id
  ) VALUES (
    1,
    p_base_price_per_tournament,
    p_base_price_per_team,
    p_duration_multiplier_hasta_3,
    p_duration_multiplier_4_to_6,
    p_duration_multiplier_7_to_12,
    p_volume_multiplier_1_to_2,
    p_volume_multiplier_3_to_5,
    p_volume_multiplier_6_plus,
    now(),
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    base_price_per_tournament = EXCLUDED.base_price_per_tournament,
    base_price_per_team = EXCLUDED.base_price_per_team,
    duration_multiplier_hasta_3 = EXCLUDED.duration_multiplier_hasta_3,
    duration_multiplier_4_to_6 = EXCLUDED.duration_multiplier_4_to_6,
    duration_multiplier_7_to_12 = EXCLUDED.duration_multiplier_7_to_12,
    volume_multiplier_1_to_2 = EXCLUDED.volume_multiplier_1_to_2,
    volume_multiplier_3_to_5 = EXCLUDED.volume_multiplier_3_to_5,
    volume_multiplier_6_plus = EXCLUDED.volume_multiplier_6_plus,
    updated_at = now(),
    updated_by_profile_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_pricing_defaults(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_platform_pricing_defaults(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) TO authenticated;
