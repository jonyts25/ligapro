-- Migration 006b: match_events
-- Records on-pitch events only. No card accumulation, no suspension generation,
-- no match_officials capture permission (deferred until season_roles exists).

-- ---------------------------------------------------------------------------
-- match_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_player_id uuid NOT NULL REFERENCES public.season_team_players (id),
  event_type text NOT NULL,
  minute integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_events_event_type_check CHECK (
    event_type IN (
      'goal',
      'own_goal',
      'yellow_card',
      'red_card',
      'substitution_in',
      'substitution_out',
      'injury'
    )
  ),
  CONSTRAINT match_events_minute_check CHECK (
    minute >= 0 AND minute <= 130
  )
);

CREATE INDEX match_events_match_id_idx ON public.match_events (match_id);
CREATE INDEX match_events_organization_id_idx ON public.match_events (organization_id);
CREATE INDEX match_events_season_team_player_id_idx
  ON public.match_events (season_team_player_id);

CREATE TRIGGER match_events_set_updated_at
  BEFORE UPDATE ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- organization_id must match the parent match's organization_id
CREATE OR REPLACE FUNCTION public.match_events_enforce_org_matches_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_org uuid;
BEGIN
  SELECT m.organization_id INTO v_match_org
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_match_org IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', NEW.match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_match_org THEN
    RAISE EXCEPTION
      'match_events.organization_id (%) must match matches.organization_id (%) for match %',
      NEW.organization_id,
      v_match_org,
      NEW.match_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_events_enforce_org_matches_match
  BEFORE INSERT OR UPDATE OF match_id, organization_id
  ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.match_events_enforce_org_matches_match();

-- season_team_player must belong to home OR away season_team of the match
CREATE OR REPLACE FUNCTION public.match_events_enforce_player_on_match_roster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_st uuid;
  v_away_st uuid;
  v_player_st uuid;
BEGIN
  SELECT m.home_season_team_id, m.away_season_team_id
  INTO v_home_st, v_away_st
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_home_st IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', NEW.match_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.season_team_id INTO v_player_st
  FROM public.season_team_players stp
  WHERE stp.id = NEW.season_team_player_id;

  IF v_player_st IS NULL THEN
    RAISE EXCEPTION 'season_team_player % does not exist', NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_player_st IS DISTINCT FROM v_home_st
     AND v_player_st IS DISTINCT FROM v_away_st THEN
    RAISE EXCEPTION
      'match_events.season_team_player_id (%) belongs to season_team %, but match % has home_season_team_id % and away_season_team_id % — player must be on one of the two match teams',
      NEW.season_team_player_id,
      v_player_st,
      NEW.match_id,
      v_home_st,
      v_away_st
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_events_enforce_player_on_match_roster
  BEFORE INSERT OR UPDATE OF match_id, season_team_player_id
  ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.match_events_enforce_player_on_match_roster();

COMMENT ON TABLE public.match_events IS
  'On-pitch events. No lineup validation for substitutions yet. Officials capture RLS deferred until season_roles.';

-- ---------------------------------------------------------------------------
-- RLS
-- Owner/admin write only. Match-official capture (confirmed referee/delegate)
-- is intentionally NOT enabled here — depends on season_roles design.
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_events_select_member
  ON public.match_events FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY match_events_insert_owner_or_admin
  ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY match_events_update_owner_or_admin
  ON public.match_events FOR UPDATE TO authenticated
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

CREATE POLICY match_events_delete_owner_or_admin
  ON public.match_events FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.match_events FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_events TO authenticated;
