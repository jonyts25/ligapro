-- Auto-generate chronicle when match result becomes official (pg_net webhook).

-- =============================================================================
-- Public read: expose whether the result is official
-- =============================================================================
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

-- =============================================================================
-- BLOQUE A — Trigger webhook on result approval (Claude applies; requires pg_net)
-- =============================================================================
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.__notify_chronicle_on_result_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := current_setting('app.settings.chronicle_webhook_url', true);
  v_secret text := current_setting('app.settings.chronicle_webhook_secret', true);
BEGIN
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('match_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ligera-webhook-secret', v_secret
    ),
    timeout_milliseconds := 60000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chronicle_on_result_approved ON public.matches;

CREATE TRIGGER chronicle_on_result_approved
  AFTER UPDATE OF result_approved_at ON public.matches
  FOR EACH ROW
  WHEN (
    OLD.result_approved_at IS NULL
    AND NEW.result_approved_at IS NOT NULL
    AND NEW.status IN ('finished', 'walkover')
  )
  EXECUTE FUNCTION public.__notify_chronicle_on_result_approved();

-- =============================================================================
-- BLOQUE B — Claude configura después de revisar (NO ejecutar desde Cursor)
-- =============================================================================
-- ALTER DATABASE postgres SET app.settings.chronicle_webhook_url =
--   'https://<dominio-railway>/api/internal/chronicles/auto-generate';
-- ALTER DATABASE postgres SET app.settings.chronicle_webhook_secret =
--   '<mismo valor que CHRONICLE_WEBHOOK_SECRET en Railway>';
