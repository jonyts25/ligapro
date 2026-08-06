-- Migration DRAFT: ai_jobs (worker local) + datos para crónicas básicas/premium
-- ADR pendiente: 0013-cronicas-ia-y-datos-premium (crear antes de aplicar, según
-- tu propia disciplina de "decisiones antes de que Cursor toque código")
--
-- Sigue exactamente los patrones ya usados en el repo:
--   - organization_id denormalizado + trigger de consistencia
--   - RLS: owner/admin para escritura, member para lectura
--   - set_updated_at + audit_row_change reusados de migraciones anteriores
--   - Nada se borra físicamente; todo es aditivo
--
-- NO PROBADO CONTRA LA BD REAL (no tengo Supabase conectado en esta sesión).
-- Revísala y corre tu suite de tests con PASS/FAIL antes de aplicar, como
-- siempre haces.

-- =============================================================================
-- 1) ai_jobs — cola propia de Ligera (NO compartida con el proyecto de Equivalente)
-- =============================================================================
-- Decisión: cada producto (Ligera, Equivalente, Mundial Compas más adelante)
-- mantiene su PROPIA tabla ai_jobs en su PROPIO proyecto de Supabase.
-- El worker de Node en tu PC se conecta a ambos proyectos (dos sets de
-- credenciales) y procesa la cola de cada uno por separado con el mismo
-- Ollama local. No se centraliza en un solo proyecto porque:
--   - Ligera no debe depender de la disponibilidad/esquema del proyecto de
--     Equivalente para su propia funcionalidad core (acoplamiento cruzado
--     entre productos que no deberían compartir tenancy)
--   - Mantiene el mismo principio de aislamiento que ya sigues entre apps
--   - El worker sigue siendo "un solo script, varias colas" — no cambia su
--     lógica interna, solo itera sobre N conexiones en vez de una
CREATE TABLE public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  app text NOT NULL DEFAULT 'ligera',
  tipo text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  resultado jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT ai_jobs_app_check CHECK (app IN ('ligera')),
  CONSTRAINT ai_jobs_tipo_check CHECK (tipo IN ('cronica')),
  CONSTRAINT ai_jobs_status_check CHECK (
    status IN ('pending', 'processing', 'done', 'error')
  )
);

CREATE INDEX ai_jobs_status_idx ON public.ai_jobs (status);
CREATE INDEX ai_jobs_organization_id_idx ON public.ai_jobs (organization_id);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

-- El worker usa la service role key (bypassa RLS). Estas policies son solo
-- para que la app autenticada pueda encolar/consultar desde el dashboard.
CREATE POLICY ai_jobs_select_member
  ON public.ai_jobs FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY ai_jobs_insert_owner_or_admin
  ON public.ai_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

REVOKE ALL ON TABLE public.ai_jobs FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.ai_jobs TO authenticated;

CREATE TRIGGER audit_ai_jobs
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

-- =============================================================================
-- 2) match_events: agregar asistencia (mejora la crónica BÁSICA, no es premium)
-- =============================================================================
ALTER TABLE public.match_events
  ADD COLUMN assist_season_team_player_id uuid
    REFERENCES public.season_team_players (id);

COMMENT ON COLUMN public.match_events.assist_season_team_player_id IS
  'Opcional. Solo aplica a event_type = goal. Sin validación de equipo por ahora (F-siguiente si hace falta).';

-- =============================================================================
-- 3) match_team_stats — estadísticas de equipo por partido (PREMIUM, opcional)
-- =============================================================================
CREATE TABLE public.match_team_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_id uuid NOT NULL REFERENCES public.season_teams (id),
  shots integer,
  shots_on_target integer,
  possession_pct numeric(5,2),
  corners integer,
  fouls integer,
  offsides integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_team_stats_match_id_season_team_id_unique
    UNIQUE (match_id, season_team_id),
  CONSTRAINT match_team_stats_possession_check CHECK (
    possession_pct IS NULL OR (possession_pct >= 0 AND possession_pct <= 100)
  ),
  CONSTRAINT match_team_stats_nonneg_check CHECK (
    (shots IS NULL OR shots >= 0) AND
    (shots_on_target IS NULL OR shots_on_target >= 0) AND
    (corners IS NULL OR corners >= 0) AND
    (fouls IS NULL OR fouls >= 0) AND
    (offsides IS NULL OR offsides >= 0)
  )
);

CREATE INDEX match_team_stats_match_id_idx ON public.match_team_stats (match_id);
CREATE INDEX match_team_stats_organization_id_idx ON public.match_team_stats (organization_id);

CREATE TRIGGER match_team_stats_set_updated_at
  BEFORE UPDATE ON public.match_team_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.match_team_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_team_stats_select_member
  ON public.match_team_stats FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY match_team_stats_write_owner_or_admin
  ON public.match_team_stats FOR ALL TO authenticated
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

REVOKE ALL ON TABLE public.match_team_stats FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_team_stats TO authenticated;

CREATE TRIGGER audit_match_team_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.match_team_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

-- =============================================================================
-- 4) match_player_stats — estadísticas de jugador por partido (PREMIUM, opcional)
-- =============================================================================
CREATE TABLE public.match_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_player_id uuid NOT NULL REFERENCES public.season_team_players (id),
  minutes_played integer,
  passes_completed integer,
  passes_attempted integer,
  shots integer,
  shots_on_target integer,
  distance_km numeric(4,2),
  rating numeric(3,1),
  is_man_of_match boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_player_stats_unique UNIQUE (match_id, season_team_player_id)
);

CREATE INDEX match_player_stats_match_id_idx ON public.match_player_stats (match_id);
CREATE INDEX match_player_stats_organization_id_idx ON public.match_player_stats (organization_id);

-- Un solo MVP (jugador del partido) por partido
CREATE UNIQUE INDEX match_player_stats_one_mom_per_match
  ON public.match_player_stats (match_id)
  WHERE is_man_of_match = true;

CREATE TRIGGER match_player_stats_set_updated_at
  BEFORE UPDATE ON public.match_player_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_player_stats_select_member
  ON public.match_player_stats FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY match_player_stats_write_owner_or_admin
  ON public.match_player_stats FOR ALL TO authenticated
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

REVOKE ALL ON TABLE public.match_player_stats FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_player_stats TO authenticated;

CREATE TRIGGER audit_match_player_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.match_player_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

-- =============================================================================
-- 5) match_context — asistencia, clima, árbitro, nota destacada (PREMIUM, opcional)
-- =============================================================================
CREATE TABLE public.match_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  attendance integer,
  weather text,
  referee_name text,
  highlight_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_context_attendance_check CHECK (attendance IS NULL OR attendance >= 0)
);

CREATE INDEX match_context_organization_id_idx ON public.match_context (organization_id);

CREATE TRIGGER match_context_set_updated_at
  BEFORE UPDATE ON public.match_context
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.match_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_context_select_member
  ON public.match_context FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY match_context_write_owner_or_admin
  ON public.match_context FOR ALL TO authenticated
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

REVOKE ALL ON TABLE public.match_context FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_context TO authenticated;

CREATE TRIGGER audit_match_context
  AFTER INSERT OR UPDATE OR DELETE ON public.match_context
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

-- =============================================================================
-- 6) match_chronicles — texto generado, listo para publicar
-- =============================================================================
CREATE TABLE public.match_chronicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  ai_job_id uuid REFERENCES public.ai_jobs (id) ON DELETE SET NULL,
  tier text NOT NULL DEFAULT 'basico',
  content text NOT NULL,
  model_used text,
  is_published boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_chronicles_tier_check CHECK (tier IN ('basico', 'premium'))
);

CREATE INDEX match_chronicles_organization_id_idx ON public.match_chronicles (organization_id);

CREATE TRIGGER match_chronicles_set_updated_at
  BEFORE UPDATE ON public.match_chronicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.match_chronicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_chronicles_select_member
  ON public.match_chronicles FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY match_chronicles_write_owner_or_admin
  ON public.match_chronicles FOR ALL TO authenticated
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

REVOKE ALL ON TABLE public.match_chronicles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_chronicles TO authenticated;

CREATE TRIGGER audit_match_chronicles
  AFTER INSERT OR UPDATE OR DELETE ON public.match_chronicles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

-- =============================================================================
-- 7) RPC pública: exponer la crónica solo si la season es pública y está publicada
-- Mismo patrón que get_public_season_standings (F8)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_public_match_chronicle(
  p_organization_id uuid,
  p_season_slug text,
  p_match_id uuid
)
RETURNS TABLE (content text, tier text, generated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica que el partido pertenezca a una season pública de esa organización
  IF NOT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.seasons s ON s.id = m.season_id
    WHERE m.id = p_match_id
      AND s.organization_id = p_organization_id
      AND s.slug = p_season_slug
      AND s.visibility = 'public'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT mc.content, mc.tier, mc.generated_at
  FROM public.match_chronicles mc
  WHERE mc.match_id = p_match_id
    AND mc.is_published = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_match_chronicle(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_match_chronicle(uuid, text, uuid) TO anon, authenticated;
