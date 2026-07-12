-- Migration 004: teams, players, season_teams, season_team_players
-- Reuses Migration 001 helpers: is_member_of, has_role_in_org, set_updated_at
-- Captain lives ONLY in season_team_players.is_captain (no season_role for captain).
-- No matches, discipline, field_reservations, or season_roles in this block.

-- ---------------------------------------------------------------------------
-- teams (persistent identity; not bound to a season)
-- ---------------------------------------------------------------------------
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teams_organization_id_idx ON public.teams (organization_id);

CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- players (org-scoped sporting record; optional profile link)
-- ---------------------------------------------------------------------------
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX players_organization_id_idx ON public.players (organization_id);
CREATE INDEX players_profile_id_idx ON public.players (profile_id);

-- One profile → at most one player per organization
CREATE UNIQUE INDEX players_organization_id_profile_id_unique
  ON public.players (organization_id, profile_id)
  WHERE profile_id IS NOT NULL;

CREATE TRIGGER players_set_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- season_teams (team registration into a season)
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  display_name text,
  group_name text,
  registration_status text NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_teams_registration_status_check CHECK (
    registration_status IN ('registered', 'confirmed', 'withdrawn')
  ),
  CONSTRAINT season_teams_season_id_team_id_unique UNIQUE (season_id, team_id)
);

CREATE INDEX season_teams_season_id_idx ON public.season_teams (season_id);
CREATE INDEX season_teams_team_id_idx ON public.season_teams (team_id);
CREATE INDEX season_teams_organization_id_idx ON public.season_teams (organization_id);

CREATE TRIGGER season_teams_set_updated_at
  BEFORE UPDATE ON public.season_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.season_teams_enforce_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_org uuid;
  v_team_org uuid;
BEGIN
  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT t.organization_id INTO v_team_org
  FROM public.teams t
  WHERE t.id = NEW.team_id;

  IF v_team_org IS NULL THEN
    RAISE EXCEPTION 'Team % does not exist', NEW.team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION
      'season_teams.organization_id (%) must match seasons.organization_id (%) for season %',
      NEW.organization_id,
      v_season_org,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_team_org THEN
    RAISE EXCEPTION
      'season_teams.organization_id (%) must match teams.organization_id (%) for team %',
      NEW.organization_id,
      v_team_org,
      NEW.team_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_teams_enforce_org_consistency
  BEFORE INSERT OR UPDATE OF season_id, team_id, organization_id
  ON public.season_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.season_teams_enforce_org_consistency();

-- ---------------------------------------------------------------------------
-- season_team_players (roster; captain = is_captain only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_team_id uuid NOT NULL REFERENCES public.season_teams (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  jersey_number integer,
  is_captain boolean NOT NULL DEFAULT false,
  registration_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_team_players_jersey_number_check CHECK (
    jersey_number IS NULL OR jersey_number > 0
  ),
  CONSTRAINT season_team_players_registration_status_check CHECK (
    registration_status IN ('active', 'inactive', 'suspended')
  ),
  CONSTRAINT season_team_players_captain_must_be_active_check CHECK (
    NOT is_captain OR registration_status = 'active'
  ),
  CONSTRAINT season_team_players_season_team_id_player_id_unique
    UNIQUE (season_team_id, player_id)
);

CREATE INDEX season_team_players_season_team_id_idx
  ON public.season_team_players (season_team_id);
CREATE INDEX season_team_players_player_id_idx
  ON public.season_team_players (player_id);
CREATE INDEX season_team_players_organization_id_idx
  ON public.season_team_players (organization_id);

-- At most one captain per season_team
CREATE UNIQUE INDEX season_team_players_one_captain_per_team
  ON public.season_team_players (season_team_id)
  WHERE is_captain = true;

-- No duplicate jersey numbers within a roster (NULLs allowed)
CREATE UNIQUE INDEX season_team_players_jersey_unique_per_team
  ON public.season_team_players (season_team_id, jersey_number)
  WHERE jersey_number IS NOT NULL;

CREATE TRIGGER season_team_players_set_updated_at
  BEFORE UPDATE ON public.season_team_players
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.season_team_players_enforce_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_team_org uuid;
  v_player_org uuid;
BEGIN
  SELECT st.organization_id INTO v_season_team_org
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_season_team_org IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player % does not exist', NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_team_org THEN
    RAISE EXCEPTION
      'season_team_players.organization_id (%) must match season_teams.organization_id (%) for season_team %',
      NEW.organization_id,
      v_season_team_org,
      NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_player_org THEN
    RAISE EXCEPTION
      'season_team_players.organization_id (%) must match players.organization_id (%) for player %',
      NEW.organization_id,
      v_player_org,
      NEW.player_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_team_players_enforce_org_consistency
  BEFORE INSERT OR UPDATE OF season_team_id, player_id, organization_id
  ON public.season_team_players
  FOR EACH ROW
  EXECUTE FUNCTION public.season_team_players_enforce_org_consistency();

-- ---------------------------------------------------------------------------
-- RPC: atomic captain change (app MUST use this, not direct is_captain UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_season_team_captain(
  p_season_team_id uuid,
  p_player_id uuid
)
RETURNS public.season_team_players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_row public.season_team_players;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Only organization_owner or organization_admin can set captain'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.* INTO v_row
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION
      'Player % is not on the roster of season_team %',
      p_player_id,
      p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.registration_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION
      'Player % must have registration_status = active to be captain (current: %)',
      p_player_id,
      v_row.registration_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Clear existing captain first, then set new one (avoids UNIQUE violation)
  UPDATE public.season_team_players
  SET is_captain = false
  WHERE season_team_id = p_season_team_id
    AND is_captain = true
    AND player_id IS DISTINCT FROM p_player_id;

  UPDATE public.season_team_players
  SET is_captain = true,
      registration_status = 'active'
  WHERE season_team_id = p_season_team_id
    AND player_id = p_player_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- Captain app permissions via season_roles are NOT implemented here.
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_team_players ENABLE ROW LEVEL SECURITY;

-- teams
CREATE POLICY teams_select_member
  ON public.teams FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY teams_insert_owner_or_admin
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY teams_update_owner_or_admin
  ON public.teams FOR UPDATE TO authenticated
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

CREATE POLICY teams_delete_owner_or_admin
  ON public.teams FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- players
CREATE POLICY players_select_member
  ON public.players FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY players_insert_owner_or_admin
  ON public.players FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY players_update_owner_or_admin
  ON public.players FOR UPDATE TO authenticated
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

CREATE POLICY players_delete_owner_or_admin
  ON public.players FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- season_teams
CREATE POLICY season_teams_select_member
  ON public.season_teams FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY season_teams_insert_owner_or_admin
  ON public.season_teams FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY season_teams_update_owner_or_admin
  ON public.season_teams FOR UPDATE TO authenticated
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

CREATE POLICY season_teams_delete_owner_or_admin
  ON public.season_teams FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- season_team_players
CREATE POLICY season_team_players_select_member
  ON public.season_team_players FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY season_team_players_insert_owner_or_admin
  ON public.season_team_players FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY season_team_players_update_owner_or_admin
  ON public.season_team_players FOR UPDATE TO authenticated
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

CREATE POLICY season_team_players_delete_owner_or_admin
  ON public.season_team_players FOR DELETE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.teams FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.players FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.season_teams FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.season_team_players FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.season_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.season_team_players TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_season_team_captain(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.set_season_team_captain(uuid, uuid) FROM PUBLIC, anon;
