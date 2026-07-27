-- Fix: knockout RPCs must resolve season via p_round_id (028 regression on first push)
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
  PERFORM public.__assert_season_not_archived_for_knockout_round(p_round_id);
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
  v_tie record;
BEGIN
  PERFORM public.__assert_season_not_archived_for_knockout_round(p_round_id);
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
