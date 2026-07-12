-- Migration 010: immutable multi-tenant audit_log
-- Append-only. Written only by SECURITY DEFINER trigger function.
-- profiles intentionally not audited (global identity, no org tenancy).

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  changed_fields text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'database_trigger',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_check CHECK (
    action IN ('insert', 'update', 'delete')
  ),
  CONSTRAINT audit_log_source_check CHECK (
    source IN ('database_trigger', 'system_trigger')
  ),
  CONSTRAINT audit_log_entity_type_not_empty_check CHECK (
    btrim(entity_type) <> ''
  ),
  CONSTRAINT audit_log_snapshot_shape_check CHECK (
    (
      action = 'insert'
      AND before_data IS NULL
      AND after_data IS NOT NULL
    )
    OR (
      action = 'update'
      AND before_data IS NOT NULL
      AND after_data IS NOT NULL
    )
    OR (
      action = 'delete'
      AND before_data IS NOT NULL
      AND after_data IS NULL
    )
  )
);

CREATE INDEX audit_log_organization_id_created_at_idx
  ON public.audit_log (organization_id, created_at DESC);

CREATE INDEX audit_log_org_entity_created_at_idx
  ON public.audit_log (organization_id, entity_type, entity_id, created_at DESC);

CREATE INDEX audit_log_actor_created_at_idx
  ON public.audit_log (actor_profile_id, created_at DESC)
  WHERE actor_profile_id IS NOT NULL;

CREATE INDEX audit_log_entity_type_entity_id_idx
  ON public.audit_log (entity_type, entity_id);

COMMENT ON TABLE public.audit_log IS
  'Append-only multi-tenant audit trail. Written by database triggers only. Organizations with history cannot be physically deleted (FK RESTRICT); archive in a future migration.';

-- ---------------------------------------------------------------------------
-- Immutability: no UPDATE/DELETE for application users
-- Session flag app.audit_allow_delete = true is reserved for controlled teardown.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.audit_allow_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'audit_log is append-only; % is not allowed', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER audit_log_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- ---------------------------------------------------------------------------
-- Generic audit trigger function
-- TG_ARGV[0] (optional): comma-separated column names to exclude from snapshots
-- Session flag app.skip_audit = true skips writing (controlled teardown only)
-- ---------------------------------------------------------------------------
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

  IF current_setting('app.skip_audit', true) = 'true' THEN
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

-- ---------------------------------------------------------------------------
-- Install AFTER triggers on auditable tables
-- Exclusions via TG_ARGV where privacy requires it
-- ---------------------------------------------------------------------------
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_organization_members
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_venues
  AFTER INSERT OR UPDATE OR DELETE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_fields
  AFTER INSERT OR UPDATE OR DELETE ON public.fields
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_field_availability_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.field_availability_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_field_reservations
  AFTER INSERT OR UPDATE OR DELETE ON public.field_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_competitions
  AFTER INSERT OR UPDATE OR DELETE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_seasons
  AFTER INSERT OR UPDATE OR DELETE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_season_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.season_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_season_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.season_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_teams
  AFTER INSERT OR UPDATE OR DELETE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_players
  AFTER INSERT OR UPDATE OR DELETE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_season_teams
  AFTER INSERT OR UPDATE OR DELETE ON public.season_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_season_team_players
  AFTER INSERT OR UPDATE OR DELETE ON public.season_team_players
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_matches
  AFTER INSERT OR UPDATE OR DELETE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_match_officials
  AFTER INSERT OR UPDATE OR DELETE ON public.match_officials
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_match_events
  AFTER INSERT OR UPDATE OR DELETE ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_discipline_suspensions
  AFTER INSERT OR UPDATE OR DELETE ON public.discipline_suspensions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change('notes');

CREATE TRIGGER audit_team_charges
  AFTER INSERT OR UPDATE OR DELETE ON public.team_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change('description');

CREATE TRIGGER audit_team_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.team_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change('reference,notes');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_owner_or_admin
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.audit_log TO authenticated;
