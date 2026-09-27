-- Migration: team logos (public bucket team-logos, teams.logo_path, set_team_logo RPC)
-- Pattern: organization-logos + player photo path validation (org/team/uuid.ext)

-- ---------------------------------------------------------------------------
-- 1. teams.logo_path
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS logo_path text;

ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_logo_path_format;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_logo_path_format
  CHECK (
    logo_path IS NULL
    OR (
      logo_path !~ '\.\.'
      AND logo_path !~ '^/'
      AND logo_path ~ (
        '^'
        || organization_id::text
        || '/'
        || id::text
        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
      )
    )
  );

COMMENT ON COLUMN public.teams.logo_path IS
  'Public Storage path in bucket team-logos.';

-- ---------------------------------------------------------------------------
-- 2. Helpers + RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_team_logo_path(
  p_organization_id uuid,
  p_team_id uuid,
  p_logo_path text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    p_logo_path IS NOT NULL
    AND p_logo_path !~ '\.\.'
    AND p_logo_path !~ '^/'
    AND p_logo_path ~ (
      '^'
      || p_organization_id::text
      || '/'
      || p_team_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    );
$$;

CREATE OR REPLACE FUNCTION public.set_team_logo(
  p_team_id uuid,
  p_logo_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_team_id IS NULL THEN
    RAISE EXCEPTION 'Team id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT t.organization_id INTO v_org
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_logo_path IS NOT NULL
     AND NOT public.is_valid_team_logo_path(v_org, p_team_id, p_logo_path) THEN
    RAISE EXCEPTION 'Invalid logo_path'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.teams
  SET logo_path = p_logo_path
  WHERE id = p_team_id
    AND organization_id = v_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_team_logo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_team_logo(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_valid_team_logo_path(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_team_logo_path(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage bucket: team-logos (public branding assets)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-logos',
  'team-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS team_logos_insert_owner_admin ON storage.objects;
DROP POLICY IF EXISTS team_logos_select_owner_admin ON storage.objects;
DROP POLICY IF EXISTS team_logos_delete_owner_admin ON storage.objects;

CREATE POLICY team_logos_insert_owner_admin
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-logos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.is_valid_uuid_text((storage.foldername(name))[2])
    AND public.has_role_in_org(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = ((storage.foldername(name))[2])::uuid
        AND t.organization_id = ((storage.foldername(name))[1])::uuid
    )
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
  );

CREATE POLICY team_logos_select_owner_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.is_valid_uuid_text((storage.foldername(name))[2])
    AND public.has_role_in_org(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = ((storage.foldername(name))[2])::uuid
        AND t.organization_id = ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY team_logos_delete_owner_admin
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.is_valid_uuid_text((storage.foldername(name))[2])
    AND public.has_role_in_org(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = ((storage.foldername(name))[2])::uuid
        AND t.organization_id = ((storage.foldername(name))[1])::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Public match detail: expose team logo paths
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_public_match_detail(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.get_public_match_detail(
  p_organization_id uuid,
  p_season_slug text,
  p_match_id uuid
)
RETURNS TABLE (
  match_id uuid,
  home_team_name text,
  away_team_name text,
  home_team_logo_path text,
  away_team_logo_path text,
  status text,
  home_score integer,
  away_score integer,
  starts_at timestamptz,
  venue_name text,
  field_name text,
  round_label text,
  round_number integer,
  leg_number integer,
  is_result_official boolean
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
    m.id,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name),
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name),
    th.logo_path,
    ta.logo_path,
    m.status,
    m.home_score,
    m.away_score,
    fr.starts_at,
    v.name,
    f.name,
    COALESCE(kr.round_label, m.round_label),
    COALESCE(kr.round_number, m.round_number),
    m.leg_number,
    (m.result_approved_at IS NOT NULL)
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
    AND m.id = p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_match_detail(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_match_detail(uuid, text, uuid) TO anon, authenticated;
