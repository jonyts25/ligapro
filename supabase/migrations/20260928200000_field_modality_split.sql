-- Field modality, hourly rate, and parent/child split (max one nesting level)

-- ---------------------------------------------------------------------------
-- 1. fields — modality, hourly_rate, parent_field_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS modality text,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2),
  ADD COLUMN IF NOT EXISTS parent_field_id uuid REFERENCES public.fields (id) ON DELETE SET NULL;

ALTER TABLE public.fields
  DROP CONSTRAINT IF EXISTS fields_modality_check;
ALTER TABLE public.fields
  ADD CONSTRAINT fields_modality_check CHECK (
    modality IS NULL
    OR modality IN ('futbol_11', 'futbol_7', 'futbol_5_futsal')
  );

ALTER TABLE public.fields
  DROP CONSTRAINT IF EXISTS fields_hourly_rate_non_negative_check;
ALTER TABLE public.fields
  ADD CONSTRAINT fields_hourly_rate_non_negative_check CHECK (
    hourly_rate IS NULL OR hourly_rate >= 0
  );

CREATE INDEX IF NOT EXISTS fields_parent_field_id_idx
  ON public.fields (parent_field_id)
  WHERE parent_field_id IS NOT NULL;

COMMENT ON COLUMN public.fields.modality IS
  'Optional modality preset key (futbol_11 / futbol_7 / futbol_5_futsal).';
COMMENT ON COLUMN public.fields.hourly_rate IS
  'Optional hourly rental rate in MXN.';
COMMENT ON COLUMN public.fields.parent_field_id IS
  'When set, this field is a child half of the referenced parent field.';

-- ---------------------------------------------------------------------------
-- 2. Validate parent_field_id (max one nesting level, same organization)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fields_validate_parent_field_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_org uuid;
  v_parent_parent uuid;
BEGIN
  IF NEW.parent_field_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_field_id = NEW.id THEN
    RAISE EXCEPTION 'A field cannot be its own parent'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fields child
    WHERE child.parent_field_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'A field with children cannot be assigned a parent'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT f.organization_id, f.parent_field_id
  INTO v_parent_org, v_parent_parent
  FROM public.fields f
  WHERE f.id = NEW.parent_field_id;

  IF v_parent_org IS NULL THEN
    RAISE EXCEPTION 'Parent field not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Parent field must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'Parent field is already a child — only one nesting level allowed'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fields_validate_parent_field_id ON public.fields;
CREATE TRIGGER fields_validate_parent_field_id
  BEFORE INSERT OR UPDATE OF parent_field_id, organization_id
  ON public.fields
  FOR EACH ROW
  EXECUTE FUNCTION public.fields_validate_parent_field_id();

-- ---------------------------------------------------------------------------
-- 3. Parent/child reservation overlap (confirmed only; EXCLUDE unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.field_reservations_enforce_parent_child_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_parent_name text;
  v_child record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT f.parent_field_id
  INTO v_parent_id
  FROM public.fields f
  WHERE f.id = NEW.field_id;

  IF v_parent_id IS NOT NULL THEN
    SELECT p.name
    INTO v_parent_name
    FROM public.field_reservations fr
    JOIN public.fields p ON p.id = fr.field_id
    WHERE fr.field_id = v_parent_id
      AND fr.status = 'confirmed'
      AND fr.id IS DISTINCT FROM NEW.id
      AND tstzrange(fr.starts_at, fr.ends_at) && tstzrange(NEW.starts_at, NEW.ends_at)
    LIMIT 1;

    IF v_parent_name IS NOT NULL THEN
      RAISE EXCEPTION
        'La cancha completa «%» ya está reservada en ese horario',
        v_parent_name
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  FOR v_child IN
    SELECT c.id, c.name
    FROM public.fields c
    WHERE c.parent_field_id = NEW.field_id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.field_reservations fr
      WHERE fr.field_id = v_child.id
        AND fr.status = 'confirmed'
        AND fr.id IS DISTINCT FROM NEW.id
        AND tstzrange(fr.starts_at, fr.ends_at) && tstzrange(NEW.starts_at, NEW.ends_at)
    ) THEN
      RAISE EXCEPTION
        'La mitad «%» ya está reservada en ese horario',
        v_child.name
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS field_reservations_enforce_parent_child_overlap
  ON public.field_reservations;
CREATE TRIGGER field_reservations_enforce_parent_child_overlap
  BEFORE INSERT OR UPDATE OF field_id, starts_at, ends_at, status
  ON public.field_reservations
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION public.field_reservations_enforce_parent_child_overlap();

-- ---------------------------------------------------------------------------
-- 4. split_field_into_children
--    Child modality fixed to futbol_7 (typical half of a futbol_11 pitch).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.split_field_into_children(
  p_field_id uuid,
  p_child_names text[]
)
RETURNS SETOF public.fields
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_field public.fields%ROWTYPE;
  v_name text;
  v_child public.fields%ROWTYPE;
  v_rule record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_field_id IS NULL THEN
    RAISE EXCEPTION 'Field id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_child_names IS NULL OR array_length(p_child_names, 1) <> 2 THEN
    RAISE EXCEPTION 'Exactly two child names are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_field
  FROM public.fields f
  WHERE f.id = p_field_id;

  IF v_field.id IS NULL THEN
    RAISE EXCEPTION 'Field not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_field.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_field.parent_field_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot split a field that is already a child'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.fields c WHERE c.parent_field_id = p_field_id
  ) THEN
    RAISE EXCEPTION 'Field is already divided'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_name IN ARRAY p_child_names LOOP
    IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
      RAISE EXCEPTION 'Child names cannot be empty'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY p_child_names LOOP
    INSERT INTO public.fields (
      organization_id,
      venue_id,
      name,
      address,
      surface_type,
      is_active,
      modality,
      hourly_rate,
      parent_field_id
    ) VALUES (
      v_field.organization_id,
      v_field.venue_id,
      trim(v_name),
      v_field.address,
      v_field.surface_type,
      v_field.is_active,
      'futbol_7',
      v_field.hourly_rate,
      p_field_id
    )
    RETURNING * INTO v_child;

    FOR v_rule IN
      SELECT day_of_week, starts_at, ends_at
      FROM public.field_availability_rules
      WHERE field_id = p_field_id
        AND organization_id = v_field.organization_id
    LOOP
      INSERT INTO public.field_availability_rules (
        field_id,
        organization_id,
        day_of_week,
        starts_at,
        ends_at
      ) VALUES (
        v_child.id,
        v_field.organization_id,
        v_rule.day_of_week,
        v_rule.starts_at,
        v_rule.ends_at
      );
    END LOOP;

    RETURN NEXT v_child;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.split_field_into_children(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.split_field_into_children(uuid, text[]) TO authenticated;
