-- Migration 005: field_reservations
-- Single source of truth for physical field occupancy (ADR 0004).
-- Reuses: is_member_of, has_role_in_org, set_updated_at, org-consistency pattern.
-- Requires extension btree_gist (already enabled on ligapro-dev).
--
-- match_id: intentional uuid column WITHOUT FK in this migration.
-- FK field_reservations.match_id → matches(id) will be added in Migration 006
-- via ALTER TABLE once matches exists.
-- Pending 006 also: CHECK (reservation_type <> 'match' OR match_id IS NOT NULL).

CREATE TABLE public.field_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.fields (id) ON DELETE CASCADE,
  reservation_type text NOT NULL,
  -- COMMENT: FK to matches(id) deferred to Migration 006 (matches table not yet created).
  match_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_reservations_reservation_type_check CHECK (
    reservation_type IN (
      'match',
      'maintenance',
      'private_rental',
      'closed',
      'manual_block'
    )
  ),
  CONSTRAINT field_reservations_status_check CHECK (
    status IN ('confirmed', 'cancelled')
  ),
  CONSTRAINT field_reservations_time_range_check CHECK (ends_at > starts_at)
);

COMMENT ON COLUMN public.field_reservations.match_id IS
  'Nullable reference to matches.id. FK constraint deferred to Migration 006 via ALTER TABLE. Pending 006: CHECK that match_id IS NOT NULL when reservation_type = match.';

CREATE INDEX field_reservations_organization_id_idx
  ON public.field_reservations (organization_id);

CREATE INDEX field_reservations_field_id_idx
  ON public.field_reservations (field_id);

CREATE TRIGGER field_reservations_set_updated_at
  BEFORE UPDATE ON public.field_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.field_reservations_enforce_org_matches_field()
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
      'field_reservations.organization_id (%) must match fields.organization_id (%) for field %',
      NEW.organization_id,
      v_field_org,
      NEW.field_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER field_reservations_enforce_org_matches_field
  BEFORE INSERT OR UPDATE OF field_id, organization_id
  ON public.field_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.field_reservations_enforce_org_matches_field();

-- Critical: no overlapping confirmed reservations on the same field.
-- Default tstzrange bounds are [) so adjacent slots (18:00-19:00, 19:00-20:00) do not conflict.
ALTER TABLE public.field_reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    field_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (status = 'confirmed');

-- ---------------------------------------------------------------------------
-- RLS
-- Automatic creation of 'match' reservations by tournament flows is future work.
-- ---------------------------------------------------------------------------
ALTER TABLE public.field_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY field_reservations_select_member
  ON public.field_reservations
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY field_reservations_insert_owner_or_admin
  ON public.field_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY field_reservations_update_owner_or_admin
  ON public.field_reservations
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

CREATE POLICY field_reservations_delete_owner_or_admin
  ON public.field_reservations
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.field_reservations FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.field_reservations TO authenticated;
