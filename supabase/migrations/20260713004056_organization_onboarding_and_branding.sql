-- Migration 011: organization onboarding and branding
-- Evolves create_organization_with_owner: (name, slug) → (name, brand_color)
-- Adds brand_color, logo_path, organization-logos bucket, storage policies,
-- update_organization_branding / set_organization_logo RPCs.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_color text,
  ADD COLUMN IF NOT EXISTS logo_path text;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_brand_color_format;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_brand_color_format
  CHECK (
    brand_color IS NULL
    OR brand_color ~ '^#[0-9A-F]{6}$'
  );

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_logo_path_format;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_logo_path_format
  CHECK (
    logo_path IS NULL
    OR (
      logo_path !~ '\.\.'
      AND logo_path !~ '^/'
      AND logo_path ~ (
        '^'
        || id::text
        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_brand_color(p_color text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  IF p_color IS NULL OR btrim(p_color) = '' THEN
    RETURN NULL;
  END IF;

  v := upper(btrim(p_color));
  IF v !~ '^#[0-9A-F]{6}$' THEN
    RAISE EXCEPTION 'Invalid brand_color'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.slugify_organization_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := lower(btrim(p_name));
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '(^-|-$)', '', 'g');
  IF v IS NULL OR v = '' THEN
    v := 'org';
  END IF;
  IF char_length(v) > 48 THEN
    v := left(v, 48);
    v := regexp_replace(v, '-$', '', 'g');
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_uuid_text(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

CREATE OR REPLACE FUNCTION public.is_valid_organization_logo_path(
  p_organization_id uuid,
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
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    );
$$;

-- ---------------------------------------------------------------------------
-- Replace create_organization_with_owner
-- Old: (p_name text, p_slug text) RETURNS organizations
-- New: (p_name text, p_brand_color text DEFAULT NULL) RETURNS uuid
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_organization_with_owner(text, text);

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name text,
  p_brand_color text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_color text;
  v_slug text;
  v_org_id uuid;
  v_member_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_uid
  ) THEN
    RAISE EXCEPTION 'Profile not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::int INTO v_member_count
  FROM public.organization_members m
  WHERE m.profile_id = v_uid;

  IF v_member_count > 0 THEN
    RAISE EXCEPTION 'User already belongs to an organization'
      USING ERRCODE = 'P0001';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 3 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Organization name must be between 3 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  v_color := public.normalize_brand_color(p_brand_color);
  v_slug := public.slugify_organization_name(v_name)
    || '-'
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.organizations (name, slug, created_by, brand_color)
  VALUES (v_name, v_slug, v_uid, v_color)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (v_org_id, v_uid, 'organization_owner');

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_organization_branding
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_organization_branding(
  p_organization_id uuid,
  p_name text,
  p_brand_color text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_color text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    p_organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 3 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Organization name must be between 3 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  v_color := public.normalize_brand_color(p_brand_color);

  UPDATE public.organizations
  SET
    name = v_name,
    brand_color = v_color
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_organization_branding(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_organization_branding(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- set_organization_logo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_organization_logo(
  p_organization_id uuid,
  p_logo_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    p_organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_logo_path IS NOT NULL
     AND NOT public.is_valid_organization_logo_path(p_organization_id, p_logo_path) THEN
    RAISE EXCEPTION 'Invalid logo_path'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organizations
  SET logo_path = p_logo_path
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_organization_logo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_organization_logo(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.normalize_brand_color(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.slugify_organization_name(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_valid_uuid_text(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_valid_organization_logo_path(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_uuid_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_organization_logo_path(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket: organization-logos (public branding assets)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage policies (no UPDATE / no upsert)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organization_logos_insert_owner_admin ON storage.objects;
DROP POLICY IF EXISTS organization_logos_select_owner_admin ON storage.objects;
DROP POLICY IF EXISTS organization_logos_delete_owner_admin ON storage.objects;

CREATE POLICY organization_logos_insert_owner_admin
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.has_role_in_org(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
  );

CREATE POLICY organization_logos_select_owner_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.has_role_in_org(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY organization_logos_delete_owner_admin
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.has_role_in_org(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );
