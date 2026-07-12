-- Migration 010b: remove production session bypasses for audit_log
-- No app.skip_audit or app.audit_allow_delete in product code.
-- Test teardown must DISABLE TRIGGER explicitly from privileged runner only.

CREATE OR REPLACE FUNCTION public.audit_log_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; % is not allowed', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_excluded text[] := ARRAY[]::text[];
  v_arg text;
  v_org_id uuid;
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := ARRAY[]::text[];
  v_key text;
  v_old_val jsonb;
  v_new_val jsonb;
  v_source text := 'database_trigger';
BEGIN
  IF TG_TABLE_NAME = 'audit_log' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_NARGS > 0 AND TG_ARGV[0] IS NOT NULL AND btrim(TG_ARGV[0]) <> '' THEN
    v_arg := replace(TG_ARGV[0], ' ', '');
    v_excluded := string_to_array(v_arg, ',');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := NEW.id;
    ELSE
      v_org_id := NEW.organization_id;
    END IF;
    v_entity_id := NEW.id;
    v_after := to_jsonb(NEW);
    IF v_excluded IS NOT NULL THEN
      v_after := v_after - v_excluded;
    END IF;

    INSERT INTO public.audit_log (
      organization_id,
      actor_profile_id,
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      changed_fields,
      source
    ) VALUES (
      v_org_id,
      auth.uid(),
      TG_TABLE_NAME,
      v_entity_id,
      'insert',
      NULL,
      v_after,
      '{}',
      v_source
    );

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := NEW.id;
    ELSE
      v_org_id := NEW.organization_id;
    END IF;
    v_entity_id := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    IF v_excluded IS NOT NULL THEN
      v_before := v_before - v_excluded;
      v_after := v_after - v_excluded;
    END IF;

    FOR v_key IN
      SELECT DISTINCT k
      FROM (
        SELECT jsonb_object_keys(v_before) AS k
        UNION
        SELECT jsonb_object_keys(v_after) AS k
      ) keys
    LOOP
      IF v_key = 'updated_at' THEN
        CONTINUE;
      END IF;
      v_old_val := v_before -> v_key;
      v_new_val := v_after -> v_key;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;

    IF coalesce(array_length(v_changed, 1), 0) = 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.audit_log (
      organization_id,
      actor_profile_id,
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      changed_fields,
      source
    ) VALUES (
      v_org_id,
      auth.uid(),
      TG_TABLE_NAME,
      v_entity_id,
      'update',
      v_before,
      v_after,
      v_changed,
      v_source
    );

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := OLD.id;
    ELSE
      v_org_id := OLD.organization_id;
    END IF;
    v_entity_id := OLD.id;
    v_before := to_jsonb(OLD);
    IF v_excluded IS NOT NULL THEN
      v_before := v_before - v_excluded;
    END IF;

    INSERT INTO public.audit_log (
      organization_id,
      actor_profile_id,
      entity_type,
      entity_id,
      action,
      before_data,
      after_data,
      changed_fields,
      source
    ) VALUES (
      v_org_id,
      auth.uid(),
      TG_TABLE_NAME,
      v_entity_id,
      'delete',
      v_before,
      NULL,
      '{}',
      v_source
    );

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_log_prevent_mutation() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.audit_log IS
  'Append-only multi-tenant audit trail. Written by database triggers only. No session bypass flags. Organizations with history cannot be physically deleted (FK RESTRICT); archive in a future migration.';
