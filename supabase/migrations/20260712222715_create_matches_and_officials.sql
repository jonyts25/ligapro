-- Migration 006a: matches, match_officials, and deferred field_reservations.match_id FK/CHECK
-- Closes Migration 005 pendings on match_id.
-- No match_events, discipline_suspensions, or season_roles in this block.

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  home_season_team_id uuid NOT NULL REFERENCES public.season_teams (id),
  away_season_team_id uuid NOT NULL REFERENCES public.season_teams (id),
  field_reservation_id uuid REFERENCES public.field_reservations (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  home_score integer,
  away_score integer,
  round_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matches_status_check CHECK (
    status IN ('scheduled', 'in_progress', 'finished', 'cancelled', 'walkover')
  ),
  CONSTRAINT matches_home_away_distinct_check CHECK (
    home_season_team_id <> away_season_team_id
  ),
  CONSTRAINT matches_home_score_nonneg_check CHECK (
    home_score IS NULL OR home_score >= 0
  ),
  CONSTRAINT matches_away_score_nonneg_check CHECK (
    away_score IS NULL OR away_score >= 0
  ),
  CONSTRAINT matches_scores_both_or_neither_check CHECK (
    (home_score IS NULL AND away_score IS NULL)
    OR (home_score IS NOT NULL AND away_score IS NOT NULL)
  )
);

CREATE INDEX matches_season_id_idx ON public.matches (season_id);
CREATE INDEX matches_organization_id_idx ON public.matches (organization_id);
CREATE INDEX matches_home_season_team_id_idx ON public.matches (home_season_team_id);
CREATE INDEX matches_away_season_team_id_idx ON public.matches (away_season_team_id);
CREATE INDEX matches_field_reservation_id_idx ON public.matches (field_reservation_id);

CREATE TRIGGER matches_set_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- organization_id must match the parent season's organization_id
CREATE OR REPLACE FUNCTION public.matches_enforce_org_matches_season()
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
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION
      'matches.organization_id (%) must match seasons.organization_id (%) for season %',
      NEW.organization_id,
      v_season_org,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF season_id, organization_id
  ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.matches_enforce_org_matches_season();

-- home/away season_teams must belong to matches.season_id (not organization_id)
CREATE OR REPLACE FUNCTION public.matches_enforce_teams_belong_to_season()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_season uuid;
  v_away_season uuid;
BEGIN
  SELECT st.season_id INTO v_home_season
  FROM public.season_teams st
  WHERE st.id = NEW.home_season_team_id;

  IF v_home_season IS NULL THEN
    RAISE EXCEPTION 'Home season_team % does not exist', NEW.home_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_home_season IS DISTINCT FROM NEW.season_id THEN
    RAISE EXCEPTION
      'matches.home_season_team_id (%) belongs to season %, but matches.season_id is %',
      NEW.home_season_team_id,
      v_home_season,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.season_id INTO v_away_season
  FROM public.season_teams st
  WHERE st.id = NEW.away_season_team_id;

  IF v_away_season IS NULL THEN
    RAISE EXCEPTION 'Away season_team % does not exist', NEW.away_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_away_season IS DISTINCT FROM NEW.season_id THEN
    RAISE EXCEPTION
      'matches.away_season_team_id (%) belongs to season %, but matches.season_id is %',
      NEW.away_season_team_id,
      v_away_season,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_enforce_teams_belong_to_season
  BEFORE INSERT OR UPDATE OF season_id, home_season_team_id, away_season_team_id
  ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.matches_enforce_teams_belong_to_season();

-- ---------------------------------------------------------------------------
-- Close Migration 005 pendings on field_reservations.match_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.field_reservations
  ADD CONSTRAINT field_reservations_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES public.matches (id) ON DELETE SET NULL;

ALTER TABLE public.field_reservations
  ADD CONSTRAINT field_reservations_match_type_requires_match_id_check
  CHECK (reservation_type <> 'match' OR match_id IS NOT NULL);

COMMENT ON COLUMN public.field_reservations.match_id IS
  'FK → matches(id). Added in Migration 006a. CHECK requires match_id when reservation_type = match.';

-- ---------------------------------------------------------------------------
-- match_officials
-- ---------------------------------------------------------------------------
CREATE TABLE public.match_officials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_officials_role_check CHECK (
    role IN ('referee', 'assistant', 'delegate', 'scorekeeper')
  ),
  CONSTRAINT match_officials_status_check CHECK (
    status IN ('assigned', 'confirmed', 'declined')
  ),
  CONSTRAINT match_officials_match_profile_role_unique
    UNIQUE (match_id, profile_id, role)
);

CREATE INDEX match_officials_match_id_idx ON public.match_officials (match_id);
CREATE INDEX match_officials_organization_id_idx ON public.match_officials (organization_id);
CREATE INDEX match_officials_profile_id_idx ON public.match_officials (profile_id);

CREATE TRIGGER match_officials_set_updated_at
  BEFORE UPDATE ON public.match_officials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.match_officials_enforce_org_matches_match()
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
      'match_officials.organization_id (%) must match matches.organization_id (%) for match %',
      NEW.organization_id,
      v_match_org,
      NEW.match_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_officials_enforce_org_matches_match
  BEFORE INSERT OR UPDATE OF match_id, organization_id
  ON public.match_officials
  FOR EACH ROW
  EXECUTE FUNCTION public.match_officials_enforce_org_matches_match();

-- ---------------------------------------------------------------------------
-- RLS
-- Result capture by officials is NOT enabled here (006b / match_events).
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_officials ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select_member
  ON public.matches FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY matches_insert_owner_or_admin
  ON public.matches FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY matches_update_owner_or_admin
  ON public.matches FOR UPDATE TO authenticated
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

CREATE POLICY matches_delete_owner_or_admin
  ON public.matches FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY match_officials_select_member
  ON public.match_officials FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY match_officials_insert_owner_or_admin
  ON public.match_officials FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY match_officials_update_owner_or_admin
  ON public.match_officials FOR UPDATE TO authenticated
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

CREATE POLICY match_officials_delete_owner_or_admin
  ON public.match_officials FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.matches FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.match_officials FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_officials TO authenticated;
