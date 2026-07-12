-- Migration 007: discipline_suspensions
-- Auto-generates suspensions on red_card and yellow_card accumulation.
-- matches_remaining decrement by fixtures is NOT automated here.

-- ---------------------------------------------------------------------------
-- discipline_suspensions
-- ---------------------------------------------------------------------------
CREATE TABLE public.discipline_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_player_id uuid NOT NULL REFERENCES public.season_team_players (id),
  source_match_event_id uuid REFERENCES public.match_events (id),
  suspension_type text NOT NULL,
  matches_remaining integer NOT NULL,
  matches_served integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discipline_suspensions_type_check CHECK (
    suspension_type IN ('direct_red', 'accumulation', 'administrative')
  ),
  CONSTRAINT discipline_suspensions_status_check CHECK (
    status IN ('active', 'served', 'waived')
  ),
  CONSTRAINT discipline_suspensions_matches_remaining_check CHECK (
    matches_remaining >= 0
  ),
  CONSTRAINT discipline_suspensions_matches_served_check CHECK (
    matches_served >= 0
  ),
  CONSTRAINT discipline_suspensions_source_event_required_check CHECK (
    (suspension_type = 'administrative')
    OR (source_match_event_id IS NOT NULL)
  )
);

CREATE INDEX discipline_suspensions_organization_id_idx
  ON public.discipline_suspensions (organization_id);
CREATE INDEX discipline_suspensions_season_team_player_id_idx
  ON public.discipline_suspensions (season_team_player_id);
CREATE INDEX discipline_suspensions_source_match_event_id_idx
  ON public.discipline_suspensions (source_match_event_id);

CREATE TRIGGER discipline_suspensions_set_updated_at
  BEFORE UPDATE ON public.discipline_suspensions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- organization_id must match the parent season_team_player's organization_id
CREATE OR REPLACE FUNCTION public.discipline_suspensions_enforce_org_matches_stp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stp_org uuid;
BEGIN
  SELECT stp.organization_id INTO v_stp_org
  FROM public.season_team_players stp
  WHERE stp.id = NEW.season_team_player_id;

  IF v_stp_org IS NULL THEN
    RAISE EXCEPTION 'season_team_player % does not exist', NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_stp_org THEN
    RAISE EXCEPTION
      'discipline_suspensions.organization_id (%) must match season_team_players.organization_id (%) for season_team_player %',
      NEW.organization_id,
      v_stp_org,
      NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER discipline_suspensions_enforce_org_matches_stp
  BEFORE INSERT OR UPDATE OF season_team_player_id, organization_id
  ON public.discipline_suspensions
  FOR EACH ROW
  EXECUTE FUNCTION public.discipline_suspensions_enforce_org_matches_stp();

-- source_match_event must belong to the same season_team_player
CREATE OR REPLACE FUNCTION public.discipline_suspensions_enforce_source_event_same_player()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_stp uuid;
BEGIN
  IF NEW.source_match_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT me.season_team_player_id INTO v_event_stp
  FROM public.match_events me
  WHERE me.id = NEW.source_match_event_id;

  IF v_event_stp IS NULL THEN
    RAISE EXCEPTION 'match_event % does not exist', NEW.source_match_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_event_stp IS DISTINCT FROM NEW.season_team_player_id THEN
    RAISE EXCEPTION
      'discipline_suspensions.source_match_event_id (%) belongs to season_team_player %, but discipline_suspensions.season_team_player_id is % — source event must be for the same player',
      NEW.source_match_event_id,
      v_event_stp,
      NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER discipline_suspensions_enforce_source_event_same_player
  BEFORE INSERT OR UPDATE OF source_match_event_id, season_team_player_id
  ON public.discipline_suspensions
  FOR EACH ROW
  EXECUTE FUNCTION public.discipline_suspensions_enforce_source_event_same_player();

-- ---------------------------------------------------------------------------
-- Auto-generation AFTER INSERT ON match_events
-- Runs as SECURITY DEFINER — does not require the inserting user to have
-- INSERT privilege on discipline_suspensions via RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_events_generate_discipline_suspensions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_yellow_limit integer;
  v_suspension_matches integer;
  v_yellow_count integer;
BEGIN
  IF NEW.event_type NOT IN ('red_card', 'yellow_card') THEN
    RETURN NEW;
  END IF;

  SELECT st.season_id, sr.yellow_card_limit, sr.suspension_matches
  INTO v_season_id, v_yellow_limit, v_suspension_matches
  FROM public.season_team_players stp
  JOIN public.season_teams st ON st.id = stp.season_team_id
  JOIN public.season_rules sr ON sr.season_id = st.season_id
  WHERE stp.id = NEW.season_team_player_id;

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot resolve season_rules for season_team_player %',
      NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.event_type = 'red_card' THEN
    INSERT INTO public.discipline_suspensions (
      organization_id,
      season_team_player_id,
      source_match_event_id,
      suspension_type,
      matches_remaining,
      status
    ) VALUES (
      NEW.organization_id,
      NEW.season_team_player_id,
      NEW.id,
      'direct_red',
      v_suspension_matches,
      'active'
    );
    RETURN NEW;
  END IF;

  -- yellow_card: count only this season_team_player within the same season
  -- (join to season_id excludes other seasons even if player_id were shared).
  SELECT count(*)::integer INTO v_yellow_count
  FROM public.match_events me
  JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
  JOIN public.season_teams st ON st.id = stp.season_team_id
  WHERE me.event_type = 'yellow_card'
    AND me.season_team_player_id = NEW.season_team_player_id
    AND st.season_id = v_season_id;

  IF v_yellow_count > 0
     AND (v_yellow_count % v_yellow_limit) = 0 THEN
    INSERT INTO public.discipline_suspensions (
      organization_id,
      season_team_player_id,
      source_match_event_id,
      suspension_type,
      matches_remaining,
      status
    ) VALUES (
      NEW.organization_id,
      NEW.season_team_player_id,
      NEW.id,
      'accumulation',
      v_suspension_matches,
      'active'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_events_generate_discipline_suspensions
  AFTER INSERT ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.match_events_generate_discipline_suspensions();

COMMENT ON TABLE public.discipline_suspensions IS
  'Suspensions from red cards, yellow accumulation, or admin. matches_remaining is manual until fixture-driven decrement exists.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.discipline_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY discipline_suspensions_select_member
  ON public.discipline_suspensions FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY discipline_suspensions_insert_owner_or_admin
  ON public.discipline_suspensions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY discipline_suspensions_update_owner_or_admin
  ON public.discipline_suspensions FOR UPDATE TO authenticated
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

CREATE POLICY discipline_suspensions_delete_owner_or_admin
  ON public.discipline_suspensions FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.discipline_suspensions FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.discipline_suspensions TO authenticated;
