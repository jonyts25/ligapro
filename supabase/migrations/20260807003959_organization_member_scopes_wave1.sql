-- Migration: scopes de admin por temporada (ADR-0013, punto 5 — WAVE 1)
--
-- Alcance de esta migración (deliberadamente parcial, ver nota abajo):
--   1. Tabla organization_member_scopes + RLS — infraestructura, cero riesgo,
--      no la usa nada todavía hasta que se toque una función.
--   2. Helper has_role_in_org_scoped() — retro-compatible: si un miembro no
--      tiene NINGUNA fila de scope, se comporta exactamente igual que hoy
--      (admin de toda la organización). Solo se restringe si existen filas.
--   3. TRES funciones convertidas como primer lote, probadas contra datos
--      reales: update_season_with_rules, schedule_match, void_match_event.
--
-- NOTA IMPORTANTE — esto NO cubre todavía:
--   roster de equipos, disciplina, finanzas de equipo, reservas/disponibilidad
--   de cancha, brackets/knockout, captura de partido por scorekeeper, etc.
--   Esas funciones SIGUEN usando has_role_in_org sin scope — un admin con
--   scope de season hoy puede editar la temporada y programar/anular
--   partidos de ESA temporada, pero todavía tiene acceso de org completa
--   para todo lo demás. Ver docs/ADR/0013 para el resto pendiente.

-- =============================================================================
-- 1) organization_member_scopes
-- =============================================================================
CREATE TABLE public.organization_member_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_member_id uuid NOT NULL REFERENCES public.organization_members (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_profile_id uuid REFERENCES public.profiles (id),
  CONSTRAINT organization_member_scopes_scope_type_check CHECK (
    scope_type IN ('season', 'venue')
  ),
  CONSTRAINT organization_member_scopes_unique
    UNIQUE (organization_member_id, scope_type, scope_id)
);

CREATE INDEX organization_member_scopes_member_id_idx
  ON public.organization_member_scopes (organization_member_id);
CREATE INDEX organization_member_scopes_organization_id_idx
  ON public.organization_member_scopes (organization_id);

-- organization_id debe coincidir con el de organization_members (mismo patrón
-- de consistencia que ya usa todo el repo)
CREATE OR REPLACE FUNCTION public.organization_member_scopes_enforce_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_org uuid;
BEGIN
  SELECT m.organization_id INTO v_member_org
  FROM public.organization_members m
  WHERE m.id = NEW.organization_member_id;

  IF v_member_org IS NULL THEN
    RAISE EXCEPTION 'organization_member % does not exist', NEW.organization_member_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_member_org THEN
    RAISE EXCEPTION
      'organization_member_scopes.organization_id (%) must match organization_members.organization_id (%)',
      NEW.organization_id, v_member_org
      USING ERRCODE = 'P0001';
  END IF;

  -- scope_id debe existir de verdad en la tabla correspondiente
  IF NEW.scope_type = 'season' THEN
    IF NOT EXISTS (SELECT 1 FROM public.seasons s WHERE s.id = NEW.scope_id AND s.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'season % does not exist in organization %', NEW.scope_id, NEW.organization_id
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.scope_type = 'venue' THEN
    IF NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = NEW.scope_id AND v.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'venue % does not exist in organization %', NEW.scope_id, NEW.organization_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER organization_member_scopes_enforce_org_consistency
  BEFORE INSERT OR UPDATE OF organization_member_id, organization_id, scope_type, scope_id
  ON public.organization_member_scopes
  FOR EACH ROW
  EXECUTE FUNCTION public.organization_member_scopes_enforce_org_consistency();

ALTER TABLE public.organization_member_scopes ENABLE ROW LEVEL SECURITY;

-- Owner/admin de la org administran scopes de sus miembros.
-- IMPORTANTE: este chequeo usa has_role_in_org SIN scope a propósito —
-- solo un admin de organización completa (owner incluido) puede asignar o
-- quitar scopes. Un admin ya scoped no puede escalarse a sí mismo ni a otros.
CREATE POLICY organization_member_scopes_select_owner_or_admin
  ON public.organization_member_scopes FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(organization_id, ARRAY['organization_owner', 'organization_admin']::text[])
  );

CREATE POLICY organization_member_scopes_select_own
  ON public.organization_member_scopes FOR SELECT TO authenticated
  USING (
    organization_member_id IN (
      SELECT m.id FROM public.organization_members m WHERE m.profile_id = auth.uid()
    )
  );

CREATE POLICY organization_member_scopes_write_owner_or_admin
  ON public.organization_member_scopes FOR ALL TO authenticated
  USING (
    public.has_role_in_org(organization_id, ARRAY['organization_owner', 'organization_admin']::text[])
  )
  WITH CHECK (
    public.has_role_in_org(organization_id, ARRAY['organization_owner', 'organization_admin']::text[])
  );

REVOKE ALL ON TABLE public.organization_member_scopes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_member_scopes TO authenticated;

CREATE TRIGGER audit_organization_member_scopes
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_member_scopes
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

-- =============================================================================
-- 2) Helper: has_role_in_org_scoped
-- Retro-compatible: cero filas de scope para ese miembro = comportamiento
-- actual (admin de toda la organización). Con filas, restringe al scope.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.has_role_in_org_scoped(
  p_org_id uuid,
  p_roles text[],
  p_scope_type text,
  p_scope_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_scope_count integer;
BEGIN
  SELECT m.id INTO v_member_id
  FROM public.organization_members m
  WHERE m.organization_id = p_org_id
    AND m.profile_id = auth.uid()
    AND m.role = ANY (p_roles);

  IF v_member_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_scope_count
  FROM public.organization_member_scopes s
  WHERE s.organization_member_id = v_member_id;

  IF v_scope_count = 0 THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.organization_member_scopes s
    WHERE s.organization_member_id = v_member_id
      AND s.scope_type = p_scope_type
      AND s.scope_id = p_scope_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_role_in_org_scoped(uuid, text[], text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role_in_org_scoped(uuid, text[], text, uuid) TO authenticated;

COMMENT ON FUNCTION public.has_role_in_org_scoped IS
  'Como has_role_in_org, pero si el miembro tiene filas en organization_member_scopes, exige que coincidan con el scope_type/scope_id dado. Sin filas = sin restricción (retro-compatible).';

-- =============================================================================
-- 3) WAVE 1 — funciones convertidas
-- =============================================================================

-- update_season_with_rules: ya tiene p_season_id directo, es el caso más simple
CREATE OR REPLACE FUNCTION public.update_season_with_rules(
  p_season_id uuid,
  p_name text,
  p_format_type text,
  p_visibility text,
  p_starts_on date,
  p_ends_on date,
  p_points_win integer,
  p_points_draw integer,
  p_points_loss integer,
  p_allow_draws boolean,
  p_match_duration_minutes integer,
  p_minimum_rest_minutes integer,
  p_yellow_card_limit integer,
  p_suspension_matches integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_current_visibility text;
  v_name text;
  v_rules_count integer;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.visibility
  INTO v_org_id, v_current_visibility
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org_scoped(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[],
    'season',
    p_season_id
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_visibility = 'archived' AND p_visibility = 'archived' THEN
    RAISE EXCEPTION 'Esta temporada está archivada y no admite cambios'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer INTO v_rules_count
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_rules_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one season_rules row for season'
      USING ERRCODE = 'P0001';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Season name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_format_type IS NULL OR p_format_type NOT IN (
    'round_robin', 'round_robin_double', 'groups_knockout', 'knockout'
  ) THEN
    RAISE EXCEPTION 'Invalid format_type'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN (
    'draft', 'private', 'unlisted', 'public', 'archived'
  ) THEN
    RAISE EXCEPTION 'Invalid visibility'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_starts_on IS NOT NULL AND p_ends_on IS NOT NULL AND p_ends_on < p_starts_on THEN
    RAISE EXCEPTION 'ends_on must be on or after starts_on'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_points_win IS NULL OR p_points_draw IS NULL OR p_points_loss IS NULL
     OR p_allow_draws IS NULL OR p_match_duration_minutes IS NULL
     OR p_minimum_rest_minutes IS NULL OR p_yellow_card_limit IS NULL
     OR p_suspension_matches IS NULL THEN
    RAISE EXCEPTION 'All season rule values are required'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.seasons
  SET name = v_name, format_type = p_format_type, visibility = p_visibility,
      starts_on = p_starts_on, ends_on = p_ends_on
  WHERE id = p_season_id AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update season'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_rules
  SET points_win = p_points_win, points_draw = p_points_draw, points_loss = p_points_loss,
      allow_draws = p_allow_draws, match_duration_minutes = p_match_duration_minutes,
      minimum_rest_minutes = p_minimum_rest_minutes, yellow_card_limit = p_yellow_card_limit,
      suspension_matches = p_suspension_matches
  WHERE season_id = p_season_id AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update season_rules'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- schedule_match: resuelve season_id desde el partido
CREATE OR REPLACE FUNCTION public.schedule_match(
  p_match_id uuid,
  p_field_id uuid,
  p_starts_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_season uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.season_id INTO v_org, v_season
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org_scoped(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[],
    'season',
    v_season
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__schedule_match_core(
    p_match_id, p_field_id, p_starts_at, 'programado'
  );
END;
$$;

-- void_match_event: resuelve season_id vía el partido del evento
CREATE OR REPLACE FUNCTION public.void_match_event(
  p_event_id uuid,
  p_reason text
)
RETURNS public.match_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_events;
  v_season uuid;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  PERFORM public.__assert_season_not_archived_for_match_event(p_event_id);
  SELECT * INTO v_row
  FROM public.match_events
  WHERE id = p_event_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'match_event % does not exist', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT mt.season_id INTO v_season
  FROM public.matches mt
  WHERE mt.id = v_row.match_id;

  IF NOT public.has_role_in_org_scoped(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[],
    'season',
    v_season
  ) THEN
    RAISE EXCEPTION 'Not authorized to void match_event %', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'match_event % is already voided', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.match_event_void', 'true', true);

  UPDATE public.match_events
  SET voided_at = now(), voided_by_profile_id = auth.uid(),
      void_reason = v_reason, updated_at = now()
  WHERE id = p_event_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
