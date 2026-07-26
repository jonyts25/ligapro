-- Migration 025: knockout bracket engine (format_type = 'knockout' only)
-- Groups phase (groups_knockout) is Migration 026 — not included here.

-- ---------------------------------------------------------------------------
-- season_knockout_rounds
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_knockout_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_label text NOT NULL,
  bracket_size integer NOT NULL,
  is_two_legs boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_knockout_rounds_round_number_positive_check CHECK (round_number > 0),
  CONSTRAINT season_knockout_rounds_bracket_size_power_of_two_check CHECK (
    bracket_size >= 2 AND (bracket_size & (bracket_size - 1)) = 0
  ),
  CONSTRAINT season_knockout_rounds_season_round_unique UNIQUE (season_id, round_number)
);

CREATE INDEX season_knockout_rounds_season_id_idx
  ON public.season_knockout_rounds (season_id);
CREATE INDEX season_knockout_rounds_organization_id_idx
  ON public.season_knockout_rounds (organization_id);

CREATE TRIGGER season_knockout_rounds_set_updated_at
  BEFORE UPDATE ON public.season_knockout_rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- season_knockout_ties — one bracket slot (1–2 legs + optional penalties)
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_knockout_ties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  knockout_round_id uuid NOT NULL REFERENCES public.season_knockout_rounds (id) ON DELETE CASCADE,
  bracket_slot integer NOT NULL,
  home_season_team_id uuid NOT NULL REFERENCES public.season_teams (id),
  away_season_team_id uuid REFERENCES public.season_teams (id),
  penalty_winner_season_team_id uuid REFERENCES public.season_teams (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_knockout_ties_bracket_slot_positive_check CHECK (bracket_slot > 0),
  CONSTRAINT season_knockout_ties_round_slot_unique UNIQUE (knockout_round_id, bracket_slot),
  CONSTRAINT season_knockout_ties_teams_distinct_check CHECK (
    away_season_team_id IS NULL OR home_season_team_id <> away_season_team_id
  ),
  CONSTRAINT season_knockout_ties_penalty_winner_valid_check CHECK (
    penalty_winner_season_team_id IS NULL
    OR penalty_winner_season_team_id = home_season_team_id
    OR penalty_winner_season_team_id = away_season_team_id
  )
);

CREATE INDEX season_knockout_ties_knockout_round_id_idx
  ON public.season_knockout_ties (knockout_round_id);
CREATE INDEX season_knockout_ties_season_id_idx
  ON public.season_knockout_ties (season_id);

CREATE TRIGGER season_knockout_ties_set_updated_at
  BEFORE UPDATE ON public.season_knockout_ties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- matches — knockout columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS knockout_round_id uuid REFERENCES public.season_knockout_rounds (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bracket_slot integer;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_bracket_slot_positive_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_bracket_slot_positive_check
  CHECK (bracket_slot IS NULL OR bracket_slot > 0);

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_knockout_columns_pair_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_knockout_columns_pair_check
  CHECK (
    (knockout_round_id IS NULL AND bracket_slot IS NULL)
    OR (knockout_round_id IS NOT NULL AND bracket_slot IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS matches_knockout_round_slot_leg_unique
  ON public.matches (knockout_round_id, bracket_slot, leg_number)
  WHERE knockout_round_id IS NOT NULL AND leg_number IS NOT NULL;

COMMENT ON COLUMN public.matches.knockout_round_id IS
  'FK to season_knockout_rounds for elimination matches; NULL for league fixtures.';
COMMENT ON COLUMN public.matches.bracket_slot IS
  'Position within a knockout round (1-based). NULL for league matches.';

-- ---------------------------------------------------------------------------
-- Consistency triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.season_knockout_rounds_enforce_org_matches_season()
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
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION 'organization_id must match season organization'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_knockout_rounds_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF season_id, organization_id
  ON public.season_knockout_rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.season_knockout_rounds_enforce_org_matches_season();

CREATE OR REPLACE FUNCTION public.season_knockout_ties_enforce_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round record;
  v_home_season uuid;
  v_away_season uuid;
BEGIN
  SELECT kr.organization_id, kr.season_id, kr.id
  INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.id = NEW.knockout_round_id;

  IF v_round.id IS NULL THEN
    RAISE EXCEPTION 'Knockout round not found' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_round.organization_id
     OR NEW.season_id IS DISTINCT FROM v_round.season_id THEN
    RAISE EXCEPTION 'Tie organization/season must match knockout round'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.season_id INTO v_home_season
  FROM public.season_teams st
  WHERE st.id = NEW.home_season_team_id;

  IF v_home_season IS DISTINCT FROM NEW.season_id THEN
    RAISE EXCEPTION 'Home team does not belong to season' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.away_season_team_id IS NOT NULL THEN
    SELECT st.season_id INTO v_away_season
    FROM public.season_teams st
    WHERE st.id = NEW.away_season_team_id;

    IF v_away_season IS DISTINCT FROM NEW.season_id THEN
      RAISE EXCEPTION 'Away team does not belong to season' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_knockout_ties_enforce_consistency
  BEFORE INSERT OR UPDATE
  ON public.season_knockout_ties
  FOR EACH ROW
  EXECUTE FUNCTION public.season_knockout_ties_enforce_consistency();

CREATE OR REPLACE FUNCTION public.matches_enforce_knockout_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round record;
  v_tie record;
BEGIN
  IF NEW.knockout_round_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT kr.organization_id, kr.season_id, kr.is_two_legs
  INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.id = NEW.knockout_round_id;

  IF v_round.organization_id IS NULL THEN
    RAISE EXCEPTION 'Knockout round not found' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.season_id IS DISTINCT FROM v_round.season_id THEN
    RAISE EXCEPTION 'Match season must match knockout round season'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.leg_number IS NULL OR NEW.leg_number NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Knockout matches require leg_number 1 or 2'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_round.is_two_legs AND NEW.leg_number <> 1 THEN
    RAISE EXCEPTION 'Single-leg knockout round cannot have leg_number > 1'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT t.home_season_team_id, t.away_season_team_id
  INTO v_tie
  FROM public.season_knockout_ties t
  WHERE t.knockout_round_id = NEW.knockout_round_id
    AND t.bracket_slot = NEW.bracket_slot;

  IF v_tie.home_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Knockout tie not found for slot %', NEW.bracket_slot
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tie.away_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Bye slots cannot have matches'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.leg_number = 1 THEN
    IF NEW.home_season_team_id IS DISTINCT FROM v_tie.home_season_team_id
       OR NEW.away_season_team_id IS DISTINCT FROM v_tie.away_season_team_id THEN
      RAISE EXCEPTION 'Leg 1 teams must match tie definition'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NEW.home_season_team_id IS DISTINCT FROM v_tie.away_season_team_id
       OR NEW.away_season_team_id IS DISTINCT FROM v_tie.home_season_team_id THEN
      RAISE EXCEPTION 'Leg 2 must invert home/away from leg 1'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_enforce_knockout_consistency
  BEFORE INSERT OR UPDATE OF knockout_round_id, bracket_slot, leg_number,
    home_season_team_id, away_season_team_id
  ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.matches_enforce_knockout_consistency();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__knockout_next_power_of_two(p_n integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_n <= 2 THEN 2
    ELSE 1 << CEIL(LN(p_n) / LN(2))::integer
  END;
$$;

REVOKE ALL ON FUNCTION public.__knockout_next_power_of_two(integer)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__knockout_round_label(
  p_bracket_size integer,
  p_round_number integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_teams_in_round integer;
BEGIN
  v_teams_in_round := p_bracket_size / (2 ^ (p_round_number - 1));
  RETURN CASE v_teams_in_round
    WHEN 2 THEN 'Final'
    WHEN 4 THEN 'Semifinal'
    WHEN 8 THEN 'Cuartos de final'
    WHEN 16 THEN 'Octavos de final'
    WHEN 32 THEN 'Dieciseisavos de final'
    ELSE format('Ronda %s', p_round_number)
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.__knockout_round_label(integer, integer)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__knockout_tie_is_tied(p_tie_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tie record;
  v_round record;
  v_leg1 record;
  v_leg2 record;
  v_home_goals integer;
  v_away_goals integer;
BEGIN
  SELECT t.*, kr.is_two_legs
  INTO v_tie
  FROM public.season_knockout_ties t
  JOIN public.season_knockout_rounds kr ON kr.id = t.knockout_round_id
  WHERE t.id = p_tie_id;

  IF v_tie.id IS NULL THEN
    RAISE EXCEPTION 'Tie not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_tie.away_season_team_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT v_tie.is_two_legs THEN
    SELECT m.home_score, m.away_score, m.status
    INTO v_leg1
    FROM public.matches m
    WHERE m.knockout_round_id = v_tie.knockout_round_id
      AND m.bracket_slot = v_tie.bracket_slot
      AND m.leg_number = 1;

    IF v_leg1.status NOT IN ('finished', 'walkover')
       OR v_leg1.home_score IS NULL OR v_leg1.away_score IS NULL THEN
      RAISE EXCEPTION 'Match is not finished with a complete score'
        USING ERRCODE = 'P0001';
    END IF;

    RETURN v_leg1.home_score = v_leg1.away_score;
  END IF;

  SELECT m.home_score, m.away_score, m.status
  INTO v_leg1
  FROM public.matches m
  WHERE m.knockout_round_id = v_tie.knockout_round_id
    AND m.bracket_slot = v_tie.bracket_slot
    AND m.leg_number = 1;

  SELECT m.home_score, m.away_score, m.status
  INTO v_leg2
  FROM public.matches m
  WHERE m.knockout_round_id = v_tie.knockout_round_id
    AND m.bracket_slot = v_tie.bracket_slot
    AND m.leg_number = 2;

  IF v_leg1.status NOT IN ('finished', 'walkover')
     OR v_leg2.status NOT IN ('finished', 'walkover')
     OR v_leg1.home_score IS NULL OR v_leg1.away_score IS NULL
     OR v_leg2.home_score IS NULL OR v_leg2.away_score IS NULL THEN
    RAISE EXCEPTION 'Both legs must be finished with complete scores'
      USING ERRCODE = 'P0001';
  END IF;

  v_home_goals := v_leg1.home_score + v_leg2.away_score;
  v_away_goals := v_leg1.away_score + v_leg2.home_score;

  RETURN v_home_goals = v_away_goals;
END;
$$;

REVOKE ALL ON FUNCTION public.__knockout_tie_is_tied(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.__knockout_resolve_tie_winner(p_tie_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tie record;
  v_leg1 record;
  v_leg2 record;
  v_home_goals integer;
  v_away_goals integer;
BEGIN
  SELECT t.*, kr.is_two_legs
  INTO v_tie
  FROM public.season_knockout_ties t
  JOIN public.season_knockout_rounds kr ON kr.id = t.knockout_round_id
  WHERE t.id = p_tie_id;

  IF v_tie.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_tie.away_season_team_id IS NULL THEN
    RETURN v_tie.home_season_team_id;
  END IF;

  IF NOT v_tie.is_two_legs THEN
    SELECT m.home_score, m.away_score, m.status
    INTO v_leg1
    FROM public.matches m
    WHERE m.knockout_round_id = v_tie.knockout_round_id
      AND m.bracket_slot = v_tie.bracket_slot
      AND m.leg_number = 1;

    IF v_leg1.status NOT IN ('finished', 'walkover')
       OR v_leg1.home_score IS NULL OR v_leg1.away_score IS NULL THEN
      RETURN NULL;
    END IF;

    IF v_leg1.home_score > v_leg1.away_score THEN
      RETURN v_tie.home_season_team_id;
    ELSIF v_leg1.away_score > v_leg1.home_score THEN
      RETURN v_tie.away_season_team_id;
    END IF;

    RETURN v_tie.penalty_winner_season_team_id;
  END IF;

  SELECT m.home_score, m.away_score, m.status
  INTO v_leg1
  FROM public.matches m
  WHERE m.knockout_round_id = v_tie.knockout_round_id
    AND m.bracket_slot = v_tie.bracket_slot
    AND m.leg_number = 1;

  SELECT m.home_score, m.away_score, m.status
  INTO v_leg2
  FROM public.matches m
  WHERE m.knockout_round_id = v_tie.knockout_round_id
    AND m.bracket_slot = v_tie.bracket_slot
    AND m.leg_number = 2;

  IF v_leg1.status NOT IN ('finished', 'walkover')
     OR v_leg2.status NOT IN ('finished', 'walkover')
     OR v_leg1.home_score IS NULL OR v_leg1.away_score IS NULL
     OR v_leg2.home_score IS NULL OR v_leg2.away_score IS NULL THEN
    RETURN NULL;
  END IF;

  v_home_goals := v_leg1.home_score + v_leg2.away_score;
  v_away_goals := v_leg1.away_score + v_leg2.home_score;

  IF v_home_goals > v_away_goals THEN
    RETURN v_tie.home_season_team_id;
  ELSIF v_away_goals > v_home_goals THEN
    RETURN v_tie.away_season_team_id;
  END IF;

  RETURN v_tie.penalty_winner_season_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.__knockout_resolve_tie_winner(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_season_knockout_champion(p_season_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_round_id uuid;
  v_tie_id uuid;
BEGIN
  SELECT kr.id INTO v_final_round_id
  FROM public.season_knockout_rounds kr
  WHERE kr.season_id = p_season_id
  ORDER BY kr.round_number DESC
  LIMIT 1;

  IF v_final_round_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.season_knockout_ties t
    WHERE t.knockout_round_id = v_final_round_id
  ) <> 1 THEN
    RETURN NULL;
  END IF;

  SELECT t.id INTO v_tie_id
  FROM public.season_knockout_ties t
  WHERE t.knockout_round_id = v_final_round_id
  LIMIT 1;

  RETURN public.__knockout_resolve_tie_winner(v_tie_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_season_knockout_champion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_season_knockout_champion(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Internal: create matches for a non-bye tie
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__knockout_create_tie_matches(
  p_org uuid,
  p_season_id uuid,
  p_round_id uuid,
  p_round_label text,
  p_bracket_slot integer,
  p_home uuid,
  p_away uuid,
  p_is_two_legs boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.matches (
    season_id,
    organization_id,
    home_season_team_id,
    away_season_team_id,
    status,
    knockout_round_id,
    bracket_slot,
    leg_number,
    round_label
  ) VALUES (
    p_season_id,
    p_org,
    p_home,
    p_away,
    'scheduled',
    p_round_id,
    p_bracket_slot,
    1,
    p_round_label
  );

  IF p_is_two_legs THEN
    INSERT INTO public.matches (
      season_id,
      organization_id,
      home_season_team_id,
      away_season_team_id,
      status,
      knockout_round_id,
      bracket_slot,
      leg_number,
      round_label
    ) VALUES (
      p_season_id,
      p_org,
      p_away,
      p_home,
      'scheduled',
      p_round_id,
      p_bracket_slot,
      2,
      p_round_label
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.__knockout_create_tie_matches(
  uuid, uuid, uuid, text, integer, uuid, uuid, boolean
) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_season_knockout_bracket
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_season_knockout_bracket(
  p_season_id uuid,
  p_seed_mode text DEFAULT 'random'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_team_ids uuid[];
  v_n integer;
  v_bracket_size integer;
  v_num_byes integer;
  v_num_slots integer;
  v_round_id uuid;
  v_round_label text;
  v_bye_teams uuid[];
  v_play_teams uuid[];
  v_slot integer;
  v_bye_idx integer := 1;
  v_play_idx integer := 1;
  v_bye_slot integer;
  v_home uuid;
  v_away uuid;
  v_bye_slots integer[];
  i integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(NULLIF(btrim(p_seed_mode), ''), 'random') <> 'random' THEN
    RAISE EXCEPTION 'Only random seed mode is supported' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'knockout' THEN
    RAISE EXCEPTION 'Season format must be knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  IF EXISTS (SELECT 1 FROM public.matches m WHERE m.season_id = p_season_id) THEN
    RAISE EXCEPTION 'Season already has matches' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.season_knockout_rounds kr WHERE kr.season_id = p_season_id
  ) THEN
    RAISE EXCEPTION 'Season already has a knockout bracket' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(st.id ORDER BY random()), ARRAY[]::uuid[])
  INTO v_team_ids
  FROM public.season_teams st
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
    AND st.registration_status IN ('registered', 'confirmed');

  v_n := COALESCE(array_length(v_team_ids, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'At least two eligible teams are required' USING ERRCODE = 'P0001';
  END IF;

  v_bracket_size := public.__knockout_next_power_of_two(v_n);
  v_num_byes := v_bracket_size - v_n;
  v_num_slots := v_bracket_size / 2;
  v_round_label := public.__knockout_round_label(v_bracket_size, 1);

  v_bye_teams := v_team_ids[1:v_num_byes];
  v_play_teams := v_team_ids[(v_num_byes + 1):v_n];

  v_bye_slots := ARRAY[]::integer[];
  FOR i IN 1..v_num_byes LOOP
    v_bye_slots := v_bye_slots || (
      (i - 1) * v_num_slots / GREATEST(v_num_byes, 1) + 1
    )::integer;
  END LOOP;

  INSERT INTO public.season_knockout_rounds (
    organization_id,
    season_id,
    round_number,
    round_label,
    bracket_size,
    is_two_legs
  ) VALUES (
    v_org,
    p_season_id,
    1,
    v_round_label,
    v_bracket_size,
    false
  )
  RETURNING id INTO v_round_id;

  FOR v_slot IN 1..v_num_slots LOOP
    IF v_slot = ANY (v_bye_slots) THEN
      INSERT INTO public.season_knockout_ties (
        organization_id,
        season_id,
        knockout_round_id,
        bracket_slot,
        home_season_team_id,
        away_season_team_id
      ) VALUES (
        v_org,
        p_season_id,
        v_round_id,
        v_slot,
        v_bye_teams[v_bye_idx],
        NULL
      );
      v_bye_idx := v_bye_idx + 1;
    ELSE
      v_home := v_play_teams[v_play_idx];
      v_away := v_play_teams[v_play_idx + 1];
      v_play_idx := v_play_idx + 2;

      INSERT INTO public.season_knockout_ties (
        organization_id,
        season_id,
        knockout_round_id,
        bracket_slot,
        home_season_team_id,
        away_season_team_id
      ) VALUES (
        v_org,
        p_season_id,
        v_round_id,
        v_slot,
        v_home,
        v_away
      );

      PERFORM public.__knockout_create_tie_matches(
        v_org,
        p_season_id,
        v_round_id,
        v_round_label,
        v_slot,
        v_home,
        v_away,
        false
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'season_id', p_season_id,
    'round_id', v_round_id,
    'round_number', 1,
    'round_label', v_round_label,
    'bracket_size', v_bracket_size,
    'num_byes', v_num_byes,
    'num_slots', v_num_slots
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_season_knockout_bracket(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_season_knockout_bracket(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- configure_knockout_round
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.configure_knockout_round(
  p_round_id uuid,
  p_is_two_legs boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round record;
  v_tie record;
  v_active integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_round_id IS NULL OR p_is_two_legs IS NULL THEN
    RAISE EXCEPTION 'Round id and is_two_legs are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT kr.*
  INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.id = p_round_id;

  IF v_round.id IS NULL THEN
    RAISE EXCEPTION 'Knockout round not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_round.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM public.matches m
  WHERE m.knockout_round_id = p_round_id
    AND m.status <> 'scheduled';

  IF v_active > 0 THEN
    RAISE EXCEPTION 'Cannot reconfigure a round after matches have started or finished'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_round.is_two_legs IS NOT DISTINCT FROM p_is_two_legs THEN
    RETURN;
  END IF;

  UPDATE public.season_knockout_rounds
  SET is_two_legs = p_is_two_legs
  WHERE id = p_round_id;

  IF p_is_two_legs THEN
    FOR v_tie IN
      SELECT t.*
      FROM public.season_knockout_ties t
      WHERE t.knockout_round_id = p_round_id
        AND t.away_season_team_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.knockout_round_id = p_round_id
          AND m.bracket_slot = v_tie.bracket_slot
          AND m.leg_number = 2
      ) THEN
        INSERT INTO public.matches (
          season_id,
          organization_id,
          home_season_team_id,
          away_season_team_id,
          status,
          knockout_round_id,
          bracket_slot,
          leg_number,
          round_label
        ) VALUES (
          v_round.season_id,
          v_round.organization_id,
          v_tie.away_season_team_id,
          v_tie.home_season_team_id,
          'scheduled',
          p_round_id,
          v_tie.bracket_slot,
          2,
          v_round.round_label
        );
      END IF;
    END LOOP;
  ELSE
    DELETE FROM public.matches m
    WHERE m.knockout_round_id = p_round_id
      AND m.leg_number = 2
      AND m.status = 'scheduled';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_knockout_round(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configure_knockout_round(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- set_knockout_tie_penalty_winner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_knockout_tie_penalty_winner(
  p_round_id uuid,
  p_bracket_slot integer,
  p_winner_season_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round record;
  v_tie_id uuid;
  v_tie record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_round_id IS NULL OR p_bracket_slot IS NULL OR p_winner_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Round, bracket slot and winner are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT kr.* INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.id = p_round_id;

  IF v_round.id IS NULL THEN
    RAISE EXCEPTION 'Knockout round not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_round.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.id, t.home_season_team_id, t.away_season_team_id
  INTO v_tie
  FROM public.season_knockout_ties t
  WHERE t.knockout_round_id = p_round_id
    AND t.bracket_slot = p_bracket_slot;

  IF v_tie.id IS NULL THEN
    RAISE EXCEPTION 'Tie not found for bracket slot %', p_bracket_slot USING ERRCODE = 'P0001';
  END IF;

  IF v_tie.away_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Bye ties do not require penalties' USING ERRCODE = 'P0001';
  END IF;

  IF p_winner_season_team_id NOT IN (v_tie.home_season_team_id, v_tie.away_season_team_id) THEN
    RAISE EXCEPTION 'Winner must be one of the tie teams' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.__knockout_tie_is_tied(v_tie.id) THEN
    RAISE EXCEPTION 'Penalty winner can only be set when the tie is drawn on aggregate'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_knockout_ties
  SET penalty_winner_season_team_id = p_winner_season_team_id
  WHERE id = v_tie.id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_knockout_tie_penalty_winner(uuid, integer, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_knockout_tie_penalty_winner(uuid, integer, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- advance_knockout_round
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_knockout_round(
  p_season_id uuid,
  p_round_number integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_round record;
  v_next_round_number integer;
  v_current_slots integer;
  v_next_slots integer;
  v_next_round_id uuid;
  v_next_label text;
  v_tie record;
  v_winner uuid;
  v_winners uuid[];
  v_unresolved integer[];
  v_slot integer;
  v_home uuid;
  v_away uuid;
  v_champion uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT kr.*
  INTO v_round
  FROM public.season_knockout_rounds kr
  WHERE kr.season_id = p_season_id
    AND kr.round_number = p_round_number;

  IF v_round.id IS NULL THEN
    RAISE EXCEPTION 'Knockout round % not found', p_round_number USING ERRCODE = 'P0001';
  END IF;

  v_unresolved := ARRAY[]::integer[];
  v_winners := ARRAY[]::uuid[];

  FOR v_tie IN
    SELECT t.*
    FROM public.season_knockout_ties t
    WHERE t.knockout_round_id = v_round.id
    ORDER BY t.bracket_slot
  LOOP
    v_winner := public.__knockout_resolve_tie_winner(v_tie.id);
    IF v_winner IS NULL THEN
      v_unresolved := v_unresolved || v_tie.bracket_slot;
    ELSE
      v_winners[v_tie.bracket_slot] := v_winner;
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_unresolved, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Unresolved bracket slots in round %: %',
      p_round_number,
      array_to_string(v_unresolved, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  v_current_slots := v_round.bracket_size / (2 ^ p_round_number);

  IF v_current_slots <= 1 THEN
    v_champion := v_winners[1];
    RETURN jsonb_build_object(
      'season_id', p_season_id,
      'completed_round', p_round_number,
      'is_final', true,
      'champion_season_team_id', v_champion
    );
  END IF;

  v_next_round_number := p_round_number + 1;
  v_next_slots := v_current_slots / 2;

  IF EXISTS (
    SELECT 1 FROM public.season_knockout_rounds kr
    WHERE kr.season_id = p_season_id
      AND kr.round_number = v_next_round_number
  ) THEN
    RAISE EXCEPTION 'Next knockout round already exists' USING ERRCODE = 'P0001';
  END IF;

  v_next_label := public.__knockout_round_label(v_round.bracket_size, v_next_round_number);

  INSERT INTO public.season_knockout_rounds (
    organization_id,
    season_id,
    round_number,
    round_label,
    bracket_size,
    is_two_legs
  ) VALUES (
    v_org,
    p_season_id,
    v_next_round_number,
    v_next_label,
    v_round.bracket_size,
    false
  )
  RETURNING id INTO v_next_round_id;

  FOR v_slot IN 1..v_next_slots LOOP
    v_home := v_winners[(v_slot * 2) - 1];
    v_away := v_winners[v_slot * 2];

    INSERT INTO public.season_knockout_ties (
      organization_id,
      season_id,
      knockout_round_id,
      bracket_slot,
      home_season_team_id,
      away_season_team_id
    ) VALUES (
      v_org,
      p_season_id,
      v_next_round_id,
      v_slot,
      v_home,
      v_away
    );

    PERFORM public.__knockout_create_tie_matches(
      v_org,
      p_season_id,
      v_next_round_id,
      v_next_label,
      v_slot,
      v_home,
      v_away,
      false
    );
  END LOOP;

  RETURN jsonb_build_object(
    'season_id', p_season_id,
    'completed_round', p_round_number,
    'next_round_id', v_next_round_id,
    'next_round_number', v_next_round_number,
    'next_round_label', v_next_label,
    'is_final', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.advance_knockout_round(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_knockout_round(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_public_season_matches — additive knockout fields
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_public_season_matches(uuid, text);

CREATE FUNCTION public.get_public_season_matches(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  round_label text,
  round_number integer,
  sequence_in_round integer,
  home_team_name text,
  away_team_name text,
  status text,
  calendar_status text,
  home_score integer,
  away_score integer,
  starts_at timestamptz,
  venue_name text,
  field_name text,
  knockout_round_number integer,
  bracket_slot integer,
  leg_number integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(kr.round_label, m.round_label) AS round_label,
    COALESCE(kr.round_number, m.round_number) AS round_number,
    m.sequence_in_round,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name) AS home_team_name,
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name) AS away_team_name,
    m.status,
    m.calendar_status,
    m.home_score,
    m.away_score,
    fr.starts_at,
    v.name AS venue_name,
    f.name AS field_name,
    kr.round_number AS knockout_round_number,
    m.bracket_slot,
    m.leg_number
  FROM public.matches m
  JOIN public.season_teams sth ON sth.id = m.home_season_team_id
  JOIN public.teams th ON th.id = sth.team_id
  JOIN public.season_teams sta ON sta.id = m.away_season_team_id
  JOIN public.teams ta ON ta.id = sta.team_id
  LEFT JOIN public.season_knockout_rounds kr ON kr.id = m.knockout_round_id
  LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  LEFT JOIN public.fields f ON f.id = fr.field_id
  LEFT JOIN public.venues v ON v.id = f.venue_id
  WHERE m.season_id = v_season_id
  ORDER BY
    kr.round_number NULLS LAST,
    m.round_number NULLS LAST,
    m.bracket_slot NULLS LAST,
    m.leg_number NULLS LAST,
    m.sequence_in_round NULLS LAST,
    fr.starts_at NULLS LAST,
    m.created_at ASC,
    m.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_season_matches(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_season_matches(uuid, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_knockout_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_knockout_ties ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_knockout_rounds_select_member
  ON public.season_knockout_rounds FOR SELECT TO authenticated
  USING (
    public.is_member_of(organization_id)
  );

CREATE POLICY season_knockout_ties_select_member
  ON public.season_knockout_ties FOR SELECT TO authenticated
  USING (
    public.is_member_of(organization_id)
  );

REVOKE INSERT, UPDATE, DELETE ON public.season_knockout_rounds FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.season_knockout_ties FROM authenticated;
