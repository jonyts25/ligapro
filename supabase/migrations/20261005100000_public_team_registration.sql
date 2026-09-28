-- Public team registration requests (step 3.7)

-- ---------------------------------------------------------------------------
-- 1. season_rules.allow_public_team_registration
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_rules
  ADD COLUMN IF NOT EXISTS allow_public_team_registration boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.season_rules.allow_public_team_registration IS
  'When true and season visibility is public, anonymous users may submit team enrollment requests.';

-- ---------------------------------------------------------------------------
-- 2. season_team_registration_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_team_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  team_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  requested_group_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  rejection_reason text,
  reviewed_by_profile_id uuid REFERENCES public.profiles (id),
  reviewed_at timestamptz,
  created_season_team_id uuid REFERENCES public.season_teams (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX season_team_registration_requests_season_id_idx
  ON public.season_team_registration_requests (season_id);
CREATE INDEX season_team_registration_requests_organization_id_idx
  ON public.season_team_registration_requests (organization_id);
CREATE INDEX season_team_registration_requests_pending_idx
  ON public.season_team_registration_requests (season_id)
  WHERE status = 'pending';

CREATE TRIGGER season_team_registration_requests_set_updated_at
  BEFORE UPDATE ON public.season_team_registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.season_team_registration_requests IS
  'Anonymous/public team enrollment requests awaiting organizer approval.';

-- ---------------------------------------------------------------------------
-- 3. Consistency triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.season_team_registration_requests_enforce_org_matches_season()
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
    RAISE EXCEPTION 'season % does not exist', NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION
      'season_team_registration_requests.organization_id (%) must match seasons.organization_id (%) for season %',
      NEW.organization_id,
      v_season_org,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_team_registration_requests_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF organization_id, season_id
  ON public.season_team_registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.season_team_registration_requests_enforce_org_matches_season();

-- ---------------------------------------------------------------------------
-- 4. Helper: is registration open (for public UI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_public_team_registration_open(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_open boolean;
BEGIN
  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT sr.allow_public_team_registration
  INTO v_open
  FROM public.season_rules sr
  WHERE sr.season_id = v_season_id;

  RETURN COALESCE(v_open, false);
END;
$$;

REVOKE ALL ON FUNCTION public.is_public_team_registration_open(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_team_registration_open(uuid, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. submit_team_registration_request (anon-callable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_team_registration_request(
  p_organization_id uuid,
  p_season_slug text,
  p_team_name text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL,
  p_requested_group_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_org uuid;
  v_team_name text;
  v_contact_name text;
  v_email text;
  v_phone text;
  v_group text;
  v_allow boolean;
  v_request_id uuid;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'Public season not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = v_season_id;

  SELECT sr.allow_public_team_registration INTO v_allow
  FROM public.season_rules sr
  WHERE sr.season_id = v_season_id;

  IF NOT COALESCE(v_allow, false) THEN
    RAISE EXCEPTION 'Public team registration is not enabled for this season'
      USING ERRCODE = 'P0001';
  END IF;

  v_team_name := NULLIF(btrim(COALESCE(p_team_name, '')), '');
  v_contact_name := NULLIF(btrim(COALESCE(p_contact_name, '')), '');
  v_email := lower(btrim(COALESCE(p_contact_email, '')));
  v_phone := NULLIF(btrim(COALESCE(p_contact_phone, '')), '');
  v_group := NULLIF(btrim(COALESCE(p_requested_group_name, '')), '');

  IF v_team_name IS NULL THEN
    RAISE EXCEPTION 'Team name is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF char_length(v_team_name) > 100 THEN
    RAISE EXCEPTION 'Team name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_contact_name IS NULL THEN
    RAISE EXCEPTION 'Contact name is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF char_length(v_contact_name) > 100 THEN
    RAISE EXCEPTION 'Contact name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Valid contact email is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_phone IS NOT NULL AND char_length(v_phone) > 30 THEN
    RAISE EXCEPTION 'Contact phone must be at most 30 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_group IS NOT NULL AND char_length(v_group) > 100 THEN
    RAISE EXCEPTION 'Requested group name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.season_team_registration_requests (
    season_id,
    organization_id,
    team_name,
    contact_name,
    contact_email,
    contact_phone,
    requested_group_name,
    status
  ) VALUES (
    v_season_id,
    v_org,
    v_team_name,
    v_contact_name,
    v_email,
    v_phone,
    v_group,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_team_registration_request(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_team_registration_request(uuid, text, text, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. approve_team_registration_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_team_registration_request(
  p_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.season_team_registration_requests;
  v_team_id uuid;
  v_season_team_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.season_team_registration_requests
  WHERE id = p_request_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Registration request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Registration request is not pending'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.teams (organization_id, name)
  VALUES (v_row.organization_id, v_row.team_name)
  RETURNING id INTO v_team_id;

  v_season_team_id := public.enroll_team_in_season(
    v_row.season_id,
    v_team_id,
    NULL,
    v_row.requested_group_name,
    'confirmed'
  );

  PERFORM public.create_captain_player_with_invitation(
    v_season_team_id,
    v_row.contact_name,
    v_row.contact_email,
    NULL
  );

  UPDATE public.season_team_registration_requests
  SET
    status = 'approved',
    reviewed_by_profile_id = v_uid,
    reviewed_at = now(),
    created_season_team_id = v_season_team_id,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN v_season_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_team_registration_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_team_registration_request(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. reject_team_registration_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_team_registration_request(
  p_request_id uuid,
  p_reason text
)
RETURNS public.season_team_registration_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.season_team_registration_requests;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.season_team_registration_requests
  WHERE id = p_request_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Registration request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Registration request is not pending'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_team_registration_requests
  SET
    status = 'rejected',
    rejection_reason = v_reason,
    reviewed_by_profile_id = v_uid,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_team_registration_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_team_registration_request(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_team_registration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_team_registration_requests_select_admin
  ON public.season_team_registration_requests FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

GRANT SELECT ON public.season_team_registration_requests TO authenticated;
