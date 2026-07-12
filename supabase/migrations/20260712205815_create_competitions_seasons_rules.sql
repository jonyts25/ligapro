-- Migration 003: competitions, seasons, season_rules
-- Reuses Migration 001 helpers: is_member_of, has_role_in_org, set_updated_at
-- Reuses Migration 002 pattern: organization_id denormalized + consistency triggers
-- No teams, players, matches, groups, stages, brackets, season_roles, or public access.

-- ---------------------------------------------------------------------------
-- competitions
-- ---------------------------------------------------------------------------
CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX competitions_organization_id_idx ON public.competitions (organization_id);

CREATE TRIGGER competitions_set_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- seasons
-- format_type values groups_knockout/knockout are allowed labels only;
-- group/bracket tables are NOT created in this migration.
-- visibility is stored for future public views (ADR 0005); members ignore it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  format_type text NOT NULL,
  visibility text NOT NULL DEFAULT 'draft',
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasons_format_type_check CHECK (
    format_type IN (
      'round_robin',
      'round_robin_double',
      'groups_knockout',
      'knockout'
    )
  ),
  CONSTRAINT seasons_visibility_check CHECK (
    visibility IN ('draft', 'private', 'unlisted', 'public', 'archived')
  ),
  CONSTRAINT seasons_date_range_check CHECK (
    ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on
  ),
  CONSTRAINT seasons_organization_id_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX seasons_competition_id_idx ON public.seasons (competition_id);
CREATE INDEX seasons_organization_id_idx ON public.seasons (organization_id);

CREATE TRIGGER seasons_set_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.seasons_enforce_org_matches_competition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competition_org uuid;
BEGIN
  SELECT c.organization_id INTO v_competition_org
  FROM public.competitions c
  WHERE c.id = NEW.competition_id;

  IF v_competition_org IS NULL THEN
    RAISE EXCEPTION 'Competition % does not exist', NEW.competition_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_competition_org THEN
    RAISE EXCEPTION
      'seasons.organization_id (%) must match competitions.organization_id (%) for competition %',
      NEW.organization_id,
      v_competition_org,
      NEW.competition_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER seasons_enforce_org_matches_competition
  BEFORE INSERT OR UPDATE OF competition_id, organization_id ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.seasons_enforce_org_matches_competition();

-- ---------------------------------------------------------------------------
-- season_rules (exactly one row per season)
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  points_win integer NOT NULL DEFAULT 3 CHECK (points_win >= 0),
  points_draw integer NOT NULL DEFAULT 1 CHECK (points_draw >= 0),
  points_loss integer NOT NULL DEFAULT 0 CHECK (points_loss >= 0),
  allow_draws boolean NOT NULL DEFAULT true,
  match_duration_minutes integer NOT NULL DEFAULT 90 CHECK (match_duration_minutes > 0),
  minimum_rest_minutes integer NOT NULL DEFAULT 0 CHECK (minimum_rest_minutes >= 0),
  yellow_card_limit integer NOT NULL DEFAULT 5 CHECK (yellow_card_limit > 0),
  suspension_matches integer NOT NULL DEFAULT 1 CHECK (suspension_matches > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_rules_season_id_unique UNIQUE (season_id),
  CONSTRAINT season_rules_points_order_check CHECK (
    points_win >= points_draw AND points_draw >= points_loss
  )
);

CREATE INDEX season_rules_season_id_idx ON public.season_rules (season_id);

CREATE TRIGGER season_rules_set_updated_at
  BEFORE UPDATE ON public.season_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.season_rules_enforce_org_matches_season()
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
      'season_rules.organization_id (%) must match seasons.organization_id (%) for season %',
      NEW.organization_id,
      v_season_org,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_rules_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF season_id, organization_id ON public.season_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.season_rules_enforce_org_matches_season();

-- Auto-create default season_rules when a season is inserted.
-- Guarantees the 1:1 invariant; app customizes via UPDATE afterward.
CREATE OR REPLACE FUNCTION public.seasons_create_default_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.season_rules (season_id, organization_id)
  VALUES (NEW.id, NEW.organization_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seasons_create_default_rules
  AFTER INSERT ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.seasons_create_default_rules();

-- ---------------------------------------------------------------------------
-- RLS
-- SELECT for all org members regardless of seasons.visibility
-- (visibility is for future public views only — ADR 0005).
-- tournament_admin / season_roles intentionally NOT implemented here.
-- ---------------------------------------------------------------------------
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_rules ENABLE ROW LEVEL SECURITY;

-- competitions
CREATE POLICY competitions_select_member
  ON public.competitions
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY competitions_insert_owner_or_admin
  ON public.competitions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY competitions_update_owner_or_admin
  ON public.competitions
  FOR UPDATE
  TO authenticated
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

CREATE POLICY competitions_delete_owner_or_admin
  ON public.competitions
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- seasons
CREATE POLICY seasons_select_member
  ON public.seasons
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY seasons_insert_owner_or_admin
  ON public.seasons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY seasons_update_owner_or_admin
  ON public.seasons
  FOR UPDATE
  TO authenticated
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

CREATE POLICY seasons_delete_owner_or_admin
  ON public.seasons
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- season_rules
CREATE POLICY season_rules_select_member
  ON public.season_rules
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY season_rules_insert_owner_or_admin
  ON public.season_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY season_rules_update_owner_or_admin
  ON public.season_rules
  FOR UPDATE
  TO authenticated
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

CREATE POLICY season_rules_delete_owner_or_admin
  ON public.season_rules
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.competitions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.seasons FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.season_rules FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.season_rules TO authenticated;
