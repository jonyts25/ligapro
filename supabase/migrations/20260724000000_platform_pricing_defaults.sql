-- Migration 028: platform pricing defaults (cotizador staff params)
-- Persists editable price parameters — not quote lines.

-- ---------------------------------------------------------------------------
-- 1. platform_pricing_defaults (single row, no direct client access)
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_pricing_defaults (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_price_per_team numeric NOT NULL CHECK (base_price_per_team >= 0),
  duration_multiplier_hasta_3 numeric NOT NULL CHECK (duration_multiplier_hasta_3 >= 0),
  duration_multiplier_4_to_6 numeric NOT NULL CHECK (duration_multiplier_4_to_6 >= 0),
  duration_multiplier_7_to_12 numeric NOT NULL CHECK (duration_multiplier_7_to_12 >= 0),
  volume_multiplier_1_to_2 numeric NOT NULL CHECK (volume_multiplier_1_to_2 >= 0),
  volume_multiplier_3_to_5 numeric NOT NULL CHECK (volume_multiplier_3_to_5 >= 0),
  volume_multiplier_6_plus numeric NOT NULL CHECK (volume_multiplier_6_plus >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_profile_id uuid REFERENCES public.profiles(id)
);

COMMENT ON TABLE public.platform_pricing_defaults IS
  'Singleton row of LigaPro platform pricing defaults for internal cotizador. Staff RPCs only.';

ALTER TABLE public.platform_pricing_defaults ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_pricing_defaults FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_platform_pricing_defaults — platform staff only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_platform_pricing_defaults()
RETURNS TABLE (
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
    d.base_price_per_team,
    d.duration_multiplier_hasta_3,
    d.duration_multiplier_4_to_6,
    d.duration_multiplier_7_to_12,
    d.volume_multiplier_1_to_2,
    d.volume_multiplier_3_to_5,
    d.volume_multiplier_6_plus,
    d.updated_at,
    d.updated_by_profile_id
  FROM public.platform_pricing_defaults d
  WHERE d.id = 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      200::numeric,
      1.0::numeric,
      1.6::numeric,
      2.6::numeric,
      1.0::numeric,
      0.9::numeric,
      0.8::numeric,
      NULL::timestamptz,
      NULL::uuid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_pricing_defaults() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_pricing_defaults() TO authenticated;

COMMENT ON FUNCTION public.get_platform_pricing_defaults() IS
  'Returns persisted cotizador pricing defaults or code fallbacks when empty. Platform staff only.';

-- ---------------------------------------------------------------------------
-- 3. set_platform_pricing_defaults — platform staff only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_platform_pricing_defaults(
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

  IF p_base_price_per_team < 0
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
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_platform_pricing_defaults(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) TO authenticated;

COMMENT ON FUNCTION public.set_platform_pricing_defaults(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) IS
  'Upserts singleton cotizador pricing defaults. Platform staff only.';
