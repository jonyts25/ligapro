-- Migration 001: identity and multi-tenancy
-- Tables: profiles, organizations, organization_members
--
-- PROFILE CREATION (Tarea F):
-- profiles are created ONLY by trigger on auth.users (AFTER INSERT), never by the client.
-- handle_new_user() runs in the same transaction as the auth.users INSERT.
-- If the trigger fails, the signup INSERT is aborted — no auth.users row without a profile.
-- Onboarding may later UPDATE display_name (and future fields) on the existing profile.

-- ---------------------------------------------------------------------------
-- Helper: updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  CONSTRAINT organizations_slug_unique UNIQUE (slug)
);

CREATE UNIQUE INDEX organizations_slug_idx ON public.organizations (slug);

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members (single source of role per org)
-- Multiple organization_owner rows allowed; never zero (enforced by trigger).
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_role_check CHECK (
    role IN ('organization_owner', 'organization_admin', 'organization_member')
  ),
  CONSTRAINT organization_members_org_profile_unique UNIQUE (organization_id, profile_id)
);

CREATE INDEX organization_members_organization_id_idx
  ON public.organization_members (organization_id);

CREATE INDEX organization_members_profile_id_idx
  ON public.organization_members (profile_id);

-- ---------------------------------------------------------------------------
-- Trigger: create profile on auth.users insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NULL
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise so the auth.users INSERT fails atomically (no orphan user).
    RAISE EXCEPTION 'Failed to create profile for user %: %', NEW.id, SQLERRM
      USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trigger: never allow zero organization_owner rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass when organizations BEFORE DELETE wipes members for CASCADE safety.
  IF current_setting('app.bypass_last_owner_guard', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'organization_owner' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.organization_members m
        WHERE m.organization_id = OLD.organization_id
          AND m.role = 'organization_owner'
          AND m.id IS DISTINCT FROM OLD.id
      ) THEN
        RAISE EXCEPTION
          'Cannot remove the last organization_owner from organization %',
          OLD.organization_id
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: demotion away from organization_owner
  IF OLD.role = 'organization_owner'
     AND NEW.role IS DISTINCT FROM 'organization_owner' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.organization_id = OLD.organization_id
        AND m.role = 'organization_owner'
        AND m.id IS DISTINCT FROM OLD.id
    ) THEN
      RAISE EXCEPTION
        'Cannot demote the last organization_owner from organization %',
        OLD.organization_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER organization_members_prevent_last_owner
  BEFORE DELETE OR UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_owner_removal();

-- Allow organization DELETE to cascade into members (last-owner guard would
-- otherwise block CASCADE). Session flag is set only for that wipe path.
CREATE OR REPLACE FUNCTION public.organizations_wipe_members_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_last_owner_guard', 'true', true);
  DELETE FROM public.organization_members
  WHERE organization_id = OLD.id;
  PERFORM set_config('app.bypass_last_owner_guard', 'false', true);
  RETURN OLD;
END;
$$;

CREATE TRIGGER organizations_wipe_members_before_delete
  BEFORE DELETE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.organizations_wipe_members_before_delete();

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER + fixed search_path; avoid policy recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_member_of(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_org_id
      AND m.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_org(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_org_id
      AND m.profile_id = auth.uid()
      AND m.role = ANY (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: create organization + first owner atomically
-- Frontend must use this instead of separate inserts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name text,
  p_slug text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org public.organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'Organization slug is required'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (btrim(p_name), lower(btrim(p_slug)), v_uid)
  RETURNING * INTO v_org;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (v_org.id, v_uid, 'organization_owner');

  RETURN v_org;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No INSERT/DELETE policies for authenticated on profiles:
-- insert is trigger-only; delete cascades from auth.users.

-- organizations
CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(id));

CREATE POLICY organizations_update_owner_or_admin
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role_in_org(
      id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  )
  WITH CHECK (
    public.has_role_in_org(
      id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY organizations_delete_owner
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (public.has_role_in_org(id, ARRAY['organization_owner']::text[]));

-- No INSERT policy for authenticated on organizations:
-- creation goes through create_organization_with_owner().

-- organization_members
CREATE POLICY organization_members_select_member
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY organization_members_insert_owner_or_admin
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(organization_id, ARRAY['organization_owner']::text[])
    OR (
      public.has_role_in_org(organization_id, ARRAY['organization_admin']::text[])
      AND role IN ('organization_admin', 'organization_member')
    )
  );

CREATE POLICY organization_members_update_owner_or_admin
  ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role_in_org(organization_id, ARRAY['organization_owner']::text[])
    OR (
      public.has_role_in_org(organization_id, ARRAY['organization_admin']::text[])
      AND role <> 'organization_owner'
    )
  )
  WITH CHECK (
    public.has_role_in_org(organization_id, ARRAY['organization_owner']::text[])
    OR (
      public.has_role_in_org(organization_id, ARRAY['organization_admin']::text[])
      AND role IN ('organization_admin', 'organization_member')
    )
  );

CREATE POLICY organization_members_delete_owner_or_admin
  ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(organization_id, ARRAY['organization_owner']::text[])
    OR (
      public.has_role_in_org(organization_id, ARRAY['organization_admin']::text[])
      AND role <> 'organization_owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.organizations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.organization_members FROM PUBLIC, anon;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_member_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_org(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_member_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role_in_org(uuid, text[]) FROM PUBLIC, anon;
