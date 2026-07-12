-- Migration 002: venues, fields, field_availability_rules
-- Reuses Migration 001 helpers: is_member_of, has_role_in_org, set_updated_at
-- No field_reservations, competitions, seasons, teams, or public/anon access.

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX venues_organization_id_idx ON public.venues (organization_id);

CREATE TRIGGER venues_set_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- fields (organization_id denormalized for RLS; must match parent venue)
-- ---------------------------------------------------------------------------
CREATE TABLE public.fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  surface_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fields_venue_id_idx ON public.fields (venue_id);
CREATE INDEX fields_organization_id_idx ON public.fields (organization_id);

CREATE TRIGGER fields_set_updated_at
  BEFORE UPDATE ON public.fields
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.fields_enforce_org_matches_venue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_org uuid;
BEGIN
  SELECT v.organization_id INTO v_venue_org
  FROM public.venues v
  WHERE v.id = NEW.venue_id;

  IF v_venue_org IS NULL THEN
    RAISE EXCEPTION 'Venue % does not exist', NEW.venue_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_venue_org THEN
    RAISE EXCEPTION
      'fields.organization_id (%) must match venues.organization_id (%) for venue %',
      NEW.organization_id,
      v_venue_org,
      NEW.venue_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER fields_enforce_org_matches_venue
  BEFORE INSERT OR UPDATE OF venue_id, organization_id ON public.fields
  FOR EACH ROW
  EXECUTE FUNCTION public.fields_enforce_org_matches_venue();

-- ---------------------------------------------------------------------------
-- field_availability_rules (organization_id must match parent field)
-- No overlap detection here — hard conflicts belong to field_reservations.
-- ---------------------------------------------------------------------------
CREATE TABLE public.field_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_availability_rules_day_of_week_check
    CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT field_availability_rules_time_range_check
    CHECK (ends_at > starts_at)
);

CREATE INDEX field_availability_rules_field_id_idx
  ON public.field_availability_rules (field_id);

CREATE TRIGGER field_availability_rules_set_updated_at
  BEFORE UPDATE ON public.field_availability_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.field_availability_rules_enforce_org_matches_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field_org uuid;
BEGIN
  SELECT f.organization_id INTO v_field_org
  FROM public.fields f
  WHERE f.id = NEW.field_id;

  IF v_field_org IS NULL THEN
    RAISE EXCEPTION 'Field % does not exist', NEW.field_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_field_org THEN
    RAISE EXCEPTION
      'field_availability_rules.organization_id (%) must match fields.organization_id (%) for field %',
      NEW.organization_id,
      v_field_org,
      NEW.field_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER field_availability_rules_enforce_org_matches_field
  BEFORE INSERT OR UPDATE OF field_id, organization_id
  ON public.field_availability_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.field_availability_rules_enforce_org_matches_field();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_availability_rules ENABLE ROW LEVEL SECURITY;

-- venues
CREATE POLICY venues_select_member
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY venues_insert_owner_or_admin
  ON public.venues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY venues_update_owner_or_admin
  ON public.venues
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

CREATE POLICY venues_delete_owner_or_admin
  ON public.venues
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- fields
CREATE POLICY fields_select_member
  ON public.fields
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY fields_insert_owner_or_admin
  ON public.fields
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY fields_update_owner_or_admin
  ON public.fields
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

CREATE POLICY fields_delete_owner_or_admin
  ON public.fields
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- field_availability_rules
CREATE POLICY field_availability_rules_select_member
  ON public.field_availability_rules
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY field_availability_rules_insert_owner_or_admin
  ON public.field_availability_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY field_availability_rules_update_owner_or_admin
  ON public.field_availability_rules
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

CREATE POLICY field_availability_rules_delete_owner_or_admin
  ON public.field_availability_rules
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (anon denied; authenticated gated by RLS)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.venues FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.fields FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.field_availability_rules FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.venues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.field_availability_rules TO authenticated;
