-- Tournament modality presets (global catalog) + season_rules halves/min roster

-- ---------------------------------------------------------------------------
-- 1. tournament_type_presets
-- ---------------------------------------------------------------------------
CREATE TABLE public.tournament_type_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality text NOT NULL UNIQUE
    CHECK (modality IN ('futbol_11', 'futbol_7', 'futbol_5_futsal')),
  label text NOT NULL,
  players_on_field integer NOT NULL CHECK (players_on_field > 0),
  halves_count integer NOT NULL DEFAULT 2 CHECK (halves_count > 0),
  match_duration_minutes integer NOT NULL CHECK (match_duration_minutes > 0),
  points_win integer NOT NULL DEFAULT 3 CHECK (points_win >= 0),
  points_draw integer NOT NULL DEFAULT 1 CHECK (points_draw >= 0),
  points_loss integer NOT NULL DEFAULT 0 CHECK (points_loss >= 0),
  allow_draws boolean NOT NULL DEFAULT true,
  minimum_rest_minutes integer NOT NULL DEFAULT 0 CHECK (minimum_rest_minutes >= 0),
  yellow_card_limit integer NOT NULL DEFAULT 5 CHECK (yellow_card_limit > 0),
  suspension_matches integer NOT NULL DEFAULT 1 CHECK (suspension_matches > 0),
  min_roster_size integer CHECK (min_roster_size IS NULL OR min_roster_size > 0),
  max_roster_size integer CHECK (max_roster_size IS NULL OR max_roster_size > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_type_presets_roster_range_check CHECK (
    min_roster_size IS NULL
    OR max_roster_size IS NULL
    OR min_roster_size <= max_roster_size
  ),
  CONSTRAINT tournament_type_presets_points_order_check CHECK (
    points_win >= points_draw AND points_draw >= points_loss
  )
);

CREATE TRIGGER tournament_type_presets_set_updated_at
  BEFORE UPDATE ON public.tournament_type_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tournament_type_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tournament_type_presets_select_authenticated
  ON public.tournament_type_presets FOR SELECT TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.tournament_type_presets FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.tournament_type_presets TO authenticated;

COMMENT ON TABLE public.tournament_type_presets IS
  'Global modality presets for tournament setup. Writes via platform staff RPC only.';

-- ---------------------------------------------------------------------------
-- 2. season_rules — halves_count + min_roster_size
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_rules
  ADD COLUMN IF NOT EXISTS halves_count integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS min_roster_size integer;

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_halves_count_positive_check;
ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_halves_count_positive_check CHECK (halves_count > 0);

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_min_roster_size_positive_check;
ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_min_roster_size_positive_check CHECK (
    min_roster_size IS NULL OR min_roster_size > 0
  );

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_roster_size_range_check;
ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_roster_size_range_check CHECK (
    min_roster_size IS NULL
    OR max_roster_size IS NULL
    OR min_roster_size <= max_roster_size
  );

COMMENT ON COLUMN public.season_rules.halves_count IS
  'Number of halves per match (reference from modality preset).';
COMMENT ON COLUMN public.season_rules.min_roster_size IS
  'Minimum roster size per team when enforced.';

-- ---------------------------------------------------------------------------
-- 3. Seed presets
-- ---------------------------------------------------------------------------
INSERT INTO public.tournament_type_presets (
  modality,
  label,
  players_on_field,
  halves_count,
  match_duration_minutes,
  points_win,
  points_draw,
  points_loss,
  allow_draws,
  minimum_rest_minutes,
  yellow_card_limit,
  suspension_matches,
  min_roster_size,
  max_roster_size
) VALUES
  (
    'futbol_11',
    'Fútbol 11',
    11,
    2,
    90,
    3,
    1,
    0,
    true,
    0,
    5,
    1,
    14,
    25
  ),
  (
    'futbol_7',
    'Fútbol 7',
    7,
    2,
    50,
    3,
    1,
    0,
    true,
    0,
    5,
    1,
    10,
    16
  ),
  (
    'futbol_5_futsal',
    'Fútbol 5 / Futsal',
    5,
    2,
    40,
    3,
    1,
    0,
    true,
    0,
    5,
    1,
    8,
    12
  )
ON CONFLICT (modality) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tournament_type_presets()
RETURNS TABLE (
  modality text,
  label text,
  players_on_field integer,
  halves_count integer,
  match_duration_minutes integer,
  points_win integer,
  points_draw integer,
  points_loss integer,
  allow_draws boolean,
  minimum_rest_minutes integer,
  yellow_card_limit integer,
  suspension_matches integer,
  min_roster_size integer,
  max_roster_size integer,
  updated_at timestamptz
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

  RETURN QUERY
  SELECT
    p.modality,
    p.label,
    p.players_on_field,
    p.halves_count,
    p.match_duration_minutes,
    p.points_win,
    p.points_draw,
    p.points_loss,
    p.allow_draws,
    p.minimum_rest_minutes,
    p.yellow_card_limit,
    p.suspension_matches,
    p.min_roster_size,
    p.max_roster_size,
    p.updated_at
  FROM public.tournament_type_presets p
  ORDER BY p.match_duration_minutes DESC, p.label ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tournament_type_preset(
  p_modality text,
  p_label text,
  p_players_on_field integer,
  p_halves_count integer,
  p_match_duration_minutes integer,
  p_points_win integer,
  p_points_draw integer,
  p_points_loss integer,
  p_allow_draws boolean,
  p_minimum_rest_minutes integer,
  p_yellow_card_limit integer,
  p_suspension_matches integer,
  p_min_roster_size integer,
  p_max_roster_size integer
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

  IF p_modality NOT IN ('futbol_11', 'futbol_7', 'futbol_5_futsal') THEN
    RAISE EXCEPTION 'Invalid modality'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RAISE EXCEPTION 'Label is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_players_on_field <= 0
     OR p_halves_count <= 0
     OR p_match_duration_minutes <= 0
     OR p_points_win < 0
     OR p_points_draw < 0
     OR p_points_loss < 0
     OR p_minimum_rest_minutes < 0
     OR p_yellow_card_limit <= 0
     OR p_suspension_matches <= 0 THEN
    RAISE EXCEPTION 'Invalid preset values'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (p_points_win >= p_points_draw AND p_points_draw >= p_points_loss) THEN
    RAISE EXCEPTION 'Points must satisfy win >= draw >= loss'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tournament_type_presets (
    modality,
    label,
    players_on_field,
    halves_count,
    match_duration_minutes,
    points_win,
    points_draw,
    points_loss,
    allow_draws,
    minimum_rest_minutes,
    yellow_card_limit,
    suspension_matches,
    min_roster_size,
    max_roster_size,
    updated_at
  ) VALUES (
    p_modality,
    trim(p_label),
    p_players_on_field,
    p_halves_count,
    p_match_duration_minutes,
    p_points_win,
    p_points_draw,
    p_points_loss,
    p_allow_draws,
    p_minimum_rest_minutes,
    p_yellow_card_limit,
    p_suspension_matches,
    p_min_roster_size,
    p_max_roster_size,
    now()
  )
  ON CONFLICT (modality) DO UPDATE SET
    label = EXCLUDED.label,
    players_on_field = EXCLUDED.players_on_field,
    halves_count = EXCLUDED.halves_count,
    match_duration_minutes = EXCLUDED.match_duration_minutes,
    points_win = EXCLUDED.points_win,
    points_draw = EXCLUDED.points_draw,
    points_loss = EXCLUDED.points_loss,
    allow_draws = EXCLUDED.allow_draws,
    minimum_rest_minutes = EXCLUDED.minimum_rest_minutes,
    yellow_card_limit = EXCLUDED.yellow_card_limit,
    suspension_matches = EXCLUDED.suspension_matches,
    min_roster_size = EXCLUDED.min_roster_size,
    max_roster_size = EXCLUDED.max_roster_size,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_tournament_type_presets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tournament_type_presets() TO authenticated;

REVOKE ALL ON FUNCTION public.set_tournament_type_preset(
  text, text, integer, integer, integer, integer, integer, integer,
  boolean, integer, integer, integer, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tournament_type_preset(
  text, text, integer, integer, integer, integer, integer, integer,
  boolean, integer, integer, integer, integer, integer
) TO authenticated;
