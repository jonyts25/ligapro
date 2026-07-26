-- Migration 019: captain invitations, match reschedule consensus, dual calendar status,
-- recurring slot bulk scheduling. See docs/ADR/0006-reagendado-consenso-y-avisos.md.

-- ---------------------------------------------------------------------------
-- matches.calendar_status (distinct from sport status and reservation presence)
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS calendar_status text NOT NULL DEFAULT 'programado';

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_calendar_status_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_calendar_status_check
  CHECK (calendar_status IN ('programado', 'confirmado'));

COMMENT ON COLUMN public.matches.calendar_status IS
  'Calendar confirmation state: programado (scheduled draft) | confirmado (admin-confirmed; triggers future notifications).';

-- ---------------------------------------------------------------------------
-- season_rules: recurring slot defaults + reschedule TTL
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_rules
  ADD COLUMN IF NOT EXISTS recurring_slot_field_id uuid
    REFERENCES public.fields (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_slot_day_of_week integer,
  ADD COLUMN IF NOT EXISTS recurring_slot_start_time time,
  ADD COLUMN IF NOT EXISTS reschedule_request_ttl_hours integer NOT NULL DEFAULT 72;

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_recurring_slot_day_check;
ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_recurring_slot_day_check
  CHECK (
    recurring_slot_day_of_week IS NULL
    OR recurring_slot_day_of_week BETWEEN 0 AND 6
  );

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_reschedule_ttl_positive_check;
ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_reschedule_ttl_positive_check
  CHECK (reschedule_request_ttl_hours > 0);

COMMENT ON COLUMN public.season_rules.reschedule_request_ttl_hours IS
  'Hours until an unanswered reschedule proposal expires (default 72).';

-- ---------------------------------------------------------------------------
-- captain_invitations (profile link via invitee action; no Auth user pre-created)
-- ---------------------------------------------------------------------------
CREATE TABLE public.captain_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_player_id uuid NOT NULL REFERENCES public.season_team_players (id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  invited_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  accepted_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT captain_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
  ),
  CONSTRAINT captain_invitations_token_unique UNIQUE (token)
);

CREATE INDEX captain_invitations_organization_id_idx
  ON public.captain_invitations (organization_id);
CREATE INDEX captain_invitations_season_team_player_id_idx
  ON public.captain_invitations (season_team_player_id);
CREATE INDEX captain_invitations_email_idx
  ON public.captain_invitations (lower(email));

CREATE UNIQUE INDEX captain_invitations_one_pending_per_stp
  ON public.captain_invitations (season_team_player_id)
  WHERE status = 'pending';

CREATE TRIGGER captain_invitations_set_updated_at
  BEFORE UPDATE ON public.captain_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.captain_invitations_enforce_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stp_org uuid;
BEGIN
  SELECT stp.organization_id INTO v_stp_org
  FROM public.season_team_players stp
  WHERE stp.id = NEW.season_team_player_id;

  IF v_stp_org IS NULL THEN
    RAISE EXCEPTION 'Season team player % does not exist', NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_stp_org THEN
    RAISE EXCEPTION
      'captain_invitations.organization_id must match season_team_players.organization_id'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER captain_invitations_enforce_org_consistency
  BEFORE INSERT OR UPDATE OF organization_id, season_team_player_id
  ON public.captain_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.captain_invitations_enforce_org_consistency();

-- ---------------------------------------------------------------------------
-- match_reschedule_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.match_reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  proposed_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  proposed_starts_at timestamptz NOT NULL,
  proposed_field_id uuid REFERENCES public.fields (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'proposed',
  responded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  responded_at timestamptz,
  expires_at timestamptz NOT NULL,
  admin_resolved_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  admin_resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_reschedule_requests_status_check CHECK (
    status IN (
      'proposed',
      'approved_by_opponent',
      'rejected_by_opponent',
      'expired',
      'confirmed_by_admin',
      'no_availability'
    )
  )
);

CREATE INDEX match_reschedule_requests_organization_id_idx
  ON public.match_reschedule_requests (organization_id);
CREATE INDEX match_reschedule_requests_match_id_idx
  ON public.match_reschedule_requests (match_id);
CREATE INDEX match_reschedule_requests_status_idx
  ON public.match_reschedule_requests (status);

CREATE UNIQUE INDEX match_reschedule_requests_one_open_per_match
  ON public.match_reschedule_requests (match_id)
  WHERE status IN ('proposed', 'approved_by_opponent');

CREATE TRIGGER match_reschedule_requests_set_updated_at
  BEFORE UPDATE ON public.match_reschedule_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.match_reschedule_requests_enforce_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_org uuid;
BEGIN
  SELECT m.organization_id INTO v_match_org
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_match_org IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', NEW.match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_match_org THEN
    RAISE EXCEPTION
      'match_reschedule_requests.organization_id must match matches.organization_id'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_reschedule_requests_enforce_org_consistency
  BEFORE INSERT OR UPDATE OF organization_id, match_id
  ON public.match_reschedule_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.match_reschedule_requests_enforce_org_consistency();

-- ---------------------------------------------------------------------------
-- Helpers: active captain checks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_captain_of_season_team(
  p_season_team_id uuid,
  p_profile_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.season_team_players stp
    JOIN public.players p ON p.id = stp.player_id
    WHERE stp.season_team_id = p_season_team_id
      AND stp.is_captain = true
      AND stp.registration_status = 'active'
      AND p.profile_id IS NOT NULL
      AND p.profile_id = p_profile_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_captain_of_match(
  p_match_id uuid,
  p_profile_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        public.is_active_captain_of_season_team(m.home_season_team_id, p_profile_id)
        OR public.is_active_captain_of_season_team(m.away_season_team_id, p_profile_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.__captain_season_team_for_match(
  p_match_id uuid,
  p_profile_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stp.season_team_id
  FROM public.matches m
  JOIN public.season_team_players stp ON stp.season_team_id IN (
    m.home_season_team_id, m.away_season_team_id
  )
  JOIN public.players p ON p.id = stp.player_id
  WHERE m.id = p_match_id
    AND stp.is_captain = true
    AND stp.registration_status = 'active'
    AND p.profile_id = p_profile_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_active_captain_of_season_team(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_captain_of_match(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.__captain_season_team_for_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_captain_of_season_team(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_captain_of_match(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Expire stale reschedule requests (lazy; no cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_match_reschedule_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.match_reschedule_requests
  SET status = 'expired'
  WHERE status = 'proposed'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_match_reschedule_requests() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: schedule match slot (shared by schedule_match / resolve / recurring)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__schedule_match_core(
  p_match_id uuid,
  p_field_id uuid,
  p_starts_at timestamptz,
  p_calendar_status text DEFAULT 'programado'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_season uuid;
  v_status text;
  v_existing_res uuid;
  v_field_active boolean;
  v_venue_active boolean;
  v_field_org uuid;
  v_duration integer;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_dow integer;
  v_start_time time;
  v_end_time time;
  v_rule_count integer;
  v_res_id uuid;
BEGIN
  IF p_match_id IS NULL OR p_field_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'Match, field and starts_at are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_calendar_status NOT IN ('programado', 'confirmado') THEN
    RAISE EXCEPTION 'Invalid calendar_status'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.season_id, m.status, m.field_reservation_id
  INTO v_org, v_season, v_status, v_existing_res
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled matches can be programmed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    f.is_active,
    f.organization_id,
    v.is_active
  INTO v_field_active, v_field_org, v_venue_active
  FROM public.fields f
  JOIN public.venues v ON v.id = f.venue_id
  WHERE f.id = p_field_id;

  IF v_field_org IS NULL THEN
    RAISE EXCEPTION 'Field not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_field_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Field does not belong to this organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_field_active, false) THEN
    RAISE EXCEPTION 'Field is inactive'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_venue_active, false) THEN
    RAISE EXCEPTION 'Venue is inactive'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(sr.match_duration_minutes, 0)
      + COALESCE(sr.minimum_rest_minutes, 0)
  INTO v_duration
  FROM public.season_rules sr
  WHERE sr.season_id = v_season;

  IF v_duration IS NULL OR v_duration <= 0 THEN
    RAISE EXCEPTION 'Season match duration is not configured'
      USING ERRCODE = 'P0001';
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  v_local_start := p_starts_at AT TIME ZONE 'America/Mexico_City';
  v_local_end := v_ends_at AT TIME ZONE 'America/Mexico_City';

  IF v_local_start::date IS DISTINCT FROM v_local_end::date THEN
    RAISE EXCEPTION 'Match slot cannot cross midnight in America/Mexico_City'
      USING ERRCODE = 'P0001';
  END IF;

  v_dow := EXTRACT(DOW FROM v_local_start)::integer;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  SELECT COUNT(*) INTO v_rule_count
  FROM public.field_availability_rules far
  WHERE far.field_id = p_field_id
    AND far.day_of_week = v_dow;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION 'Field has no availability rules for this weekday'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_rule_count
  FROM public.field_availability_rules far
  WHERE far.field_id = p_field_id
    AND far.day_of_week = v_dow
    AND v_start_time >= far.starts_at
    AND v_end_time <= far.ends_at;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION 'Slot is outside field availability'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_existing_res IS NOT NULL THEN
    UPDATE public.field_reservations fr
    SET
      field_id = p_field_id,
      starts_at = p_starts_at,
      ends_at = v_ends_at,
      reservation_type = 'match',
      match_id = p_match_id,
      status = 'confirmed',
      title = COALESCE(fr.title, 'Partido')
    WHERE fr.id = v_existing_res
      AND fr.organization_id = v_org;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Existing reservation not found for match'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT fr.id INTO v_res_id
    FROM public.field_reservations fr
    WHERE fr.match_id = p_match_id
      AND fr.organization_id = v_org
      AND fr.reservation_type = 'match'
    ORDER BY fr.updated_at DESC
    LIMIT 1;

    IF v_res_id IS NOT NULL THEN
      UPDATE public.field_reservations
      SET
        field_id = p_field_id,
        starts_at = p_starts_at,
        ends_at = v_ends_at,
        status = 'confirmed',
        reservation_type = 'match',
        match_id = p_match_id,
        title = COALESCE(title, 'Partido')
      WHERE id = v_res_id;
    ELSE
      INSERT INTO public.field_reservations (
        organization_id,
        field_id,
        reservation_type,
        match_id,
        starts_at,
        ends_at,
        title,
        status
      ) VALUES (
        v_org,
        p_field_id,
        'match',
        p_match_id,
        p_starts_at,
        v_ends_at,
        'Partido',
        'confirmed'
      )
      RETURNING id INTO v_res_id;

      UPDATE public.matches
      SET field_reservation_id = v_res_id
      WHERE id = p_match_id
        AND organization_id = v_org;
    END IF;
  END IF;

  UPDATE public.matches
  SET calendar_status = p_calendar_status
  WHERE id = p_match_id
    AND organization_id = v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.__schedule_match_core(uuid, uuid, timestamptz, text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- schedule_match (refactored to use __schedule_match_core; always programado)
-- ---------------------------------------------------------------------------
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id INTO v_org
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__schedule_match_core(
    p_match_id,
    p_field_id,
    p_starts_at,
    'programado'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- confirm_match_calendar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_match_calendar(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_res uuid;
  v_match_status text;
  v_field_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_conflict integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Match id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.field_reservation_id, m.status
  INTO v_org, v_res, v_match_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_match_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled matches can be calendar-confirmed'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_res IS NULL THEN
    RAISE EXCEPTION 'Match has no field reservation to confirm'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT fr.field_id, fr.starts_at, fr.ends_at
  INTO v_field_id, v_starts_at, v_ends_at
  FROM public.field_reservations fr
  WHERE fr.id = v_res
    AND fr.organization_id = v_org
    AND fr.status = 'confirmed';

  IF v_field_id IS NULL THEN
    RAISE EXCEPTION 'Confirmed reservation not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_conflict
  FROM public.field_reservations fr
  WHERE fr.field_id = v_field_id
    AND fr.status = 'confirmed'
    AND fr.id IS DISTINCT FROM v_res
    AND tstzrange(fr.starts_at, fr.ends_at, '[)') &&
        tstzrange(v_starts_at, v_ends_at, '[)');

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Field reservation conflicts with another confirmed slot'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.matches
  SET calendar_status = 'confirmado'
  WHERE id = p_match_id
    AND organization_id = v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_match_calendar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_match_calendar(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Captain invitation RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_captain_to_roster(
  p_season_team_player_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
  v_is_captain boolean;
  v_invitation_id uuid;
  v_ttl_hours integer := 168;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_email := lower(btrim(COALESCE(p_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Valid email is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id, stp.is_captain
  INTO v_org, v_is_captain
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_is_captain, false) THEN
    RAISE EXCEPTION 'Player must be marked as captain before sending invitation'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.captain_invitations
  SET status = 'cancelled'
  WHERE season_team_player_id = p_season_team_player_id
    AND status = 'pending';

  INSERT INTO public.captain_invitations (
    organization_id,
    season_team_player_id,
    email,
    invited_by_profile_id,
    expires_at
  ) VALUES (
    v_org,
    p_season_team_player_id,
    v_email,
    v_uid,
    now() + interval '7 days'
  )
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_captain_player_with_invitation(
  p_season_team_id uuid,
  p_full_name text,
  p_email text,
  p_jersey_number integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stp_id uuid;
BEGIN
  v_stp_id := public.create_player_and_add_to_roster(
    p_season_team_id,
    p_full_name,
    p_jersey_number,
    'active'
  );

  PERFORM public.set_season_team_captain(
    p_season_team_id,
    (
      SELECT stp.player_id
      FROM public.season_team_players stp
      WHERE stp.id = v_stp_id
    )
  );

  PERFORM public.invite_captain_to_roster(v_stp_id, p_email);

  RETURN v_stp_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_captain_invitation(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.captain_invitations;
  v_profile_email text;
  v_player_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Invitation token is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv
  FROM public.captain_invitations ci
  WHERE ci.token = p_token;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.captain_invitations
    SET status = 'expired'
    WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(btrim(p.email)) INTO v_profile_email
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_profile_email IS DISTINCT FROM lower(btrim(v_inv.email)) THEN
    RAISE EXCEPTION 'Invitation email does not match your account'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.player_id INTO v_player_id
  FROM public.season_team_players stp
  WHERE stp.id = v_inv.season_team_player_id;

  UPDATE public.players
  SET profile_id = v_uid
  WHERE id = v_player_id
    AND organization_id = v_inv.organization_id
    AND (
      profile_id IS NULL
      OR profile_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not link profile to player record'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.captain_invitations
  SET
    status = 'accepted',
    accepted_by_profile_id = v_uid
  WHERE id = v_inv.id;

  RETURN v_inv.season_team_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_captain_to_roster(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_captain_player_with_invitation(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_captain_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_captain_to_roster(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_captain_player_with_invitation(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_captain_invitation(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reschedule RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.propose_match_reschedule(
  p_match_id uuid,
  p_proposed_starts_at timestamptz,
  p_proposed_field_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_home uuid;
  v_away uuid;
  v_captain_team uuid;
  v_ttl_hours integer;
  v_request_id uuid;
  v_field_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.expire_stale_match_reschedule_requests();

  SELECT m.organization_id, m.home_season_team_id, m.away_season_team_id
  INTO v_org, v_home, v_away
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_of_match(p_match_id, v_uid) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_captain_team := public.__captain_season_team_for_match(p_match_id, v_uid);

  IF p_proposed_starts_at IS NULL THEN
    RAISE EXCEPTION 'Proposed starts_at is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_field_id := p_proposed_field_id;
  IF v_field_id IS NULL THEN
    SELECT fr.field_id INTO v_field_id
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.id = p_match_id;
  END IF;

  SELECT sr.reschedule_request_ttl_hours INTO v_ttl_hours
  FROM public.matches m
  JOIN public.season_rules sr ON sr.season_id = m.season_id
  WHERE m.id = p_match_id;

  INSERT INTO public.match_reschedule_requests (
    organization_id,
    match_id,
    proposed_by_profile_id,
    proposed_starts_at,
    proposed_field_id,
    status,
    expires_at
  ) VALUES (
    v_org,
    p_match_id,
    v_uid,
    p_proposed_starts_at,
    v_field_id,
    'proposed',
    now() + make_interval(hours => COALESCE(v_ttl_hours, 72))
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_match_reschedule(
  p_request_id uuid,
  p_approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.match_reschedule_requests;
  v_home uuid;
  v_away uuid;
  v_proposer_team uuid;
  v_responder_team uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.expire_stale_match_reschedule_requests();

  SELECT * INTO v_req
  FROM public.match_reschedule_requests mrr
  WHERE mrr.id = p_request_id;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.status <> 'proposed' THEN
    RAISE EXCEPTION 'Request is not awaiting opponent response'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.expires_at < now() THEN
    UPDATE public.match_reschedule_requests
    SET status = 'expired'
    WHERE id = v_req.id;
    RAISE EXCEPTION 'Request has expired'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.proposed_by_profile_id = v_uid THEN
    RAISE EXCEPTION 'Proposer cannot respond to own request'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_of_match(v_req.match_id, v_uid) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.home_season_team_id, m.away_season_team_id
  INTO v_home, v_away
  FROM public.matches m
  WHERE m.id = v_req.match_id;

  v_proposer_team := public.__captain_season_team_for_match(v_req.match_id, v_req.proposed_by_profile_id);
  v_responder_team := public.__captain_season_team_for_match(v_req.match_id, v_uid);

  IF v_proposer_team IS NULL OR v_responder_team IS NULL THEN
    RAISE EXCEPTION 'Captain teams could not be resolved'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_proposer_team = v_responder_team THEN
    RAISE EXCEPTION 'Opponent captain must respond'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.match_reschedule_requests
  SET
    status = CASE
      WHEN p_approve THEN 'approved_by_opponent'
      ELSE 'rejected_by_opponent'
    END,
    responded_by_profile_id = v_uid,
    responded_at = now()
  WHERE id = v_req.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_match_reschedule(
  p_request_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.match_reschedule_requests;
  v_field_id uuid;
  v_notes text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.expire_stale_match_reschedule_requests();

  SELECT * INTO v_req
  FROM public.match_reschedule_requests mrr
  WHERE mrr.id = p_request_id;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_req.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_req.status <> 'approved_by_opponent' THEN
    RAISE EXCEPTION 'Request must be approved by opponent before admin resolution'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  IF p_action = 'no_availability' THEN
    UPDATE public.match_reschedule_requests
    SET
      status = 'no_availability',
      admin_resolved_by_profile_id = v_uid,
      admin_resolution_notes = v_notes
    WHERE id = v_req.id;
    RETURN;
  END IF;

  IF p_action <> 'confirm' THEN
    RAISE EXCEPTION 'Action must be confirm or no_availability'
      USING ERRCODE = 'P0001';
  END IF;

  v_field_id := v_req.proposed_field_id;
  IF v_field_id IS NULL THEN
    SELECT fr.field_id INTO v_field_id
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.id = v_req.match_id;
  END IF;

  IF v_field_id IS NULL THEN
    RAISE EXCEPTION 'Proposed field is required to confirm reschedule'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__schedule_match_core(
    v_req.match_id,
    v_field_id,
    v_req.proposed_starts_at,
    'confirmado'
  );

  UPDATE public.match_reschedule_requests
  SET
    status = 'confirmed_by_admin',
    admin_resolved_by_profile_id = v_uid,
    admin_resolution_notes = v_notes
  WHERE id = v_req.id;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_match_reschedule(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_match_reschedule(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_match_reschedule(uuid, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_match_reschedule(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_match_reschedule(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- apply_recurring_slot_to_season
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__round_slot_starts_at(
  p_season_id uuid,
  p_round_number integer,
  p_day_of_week integer,
  p_start_time time
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starts_on date;
  v_anchor date;
  v_delta integer;
  v_local timestamp;
BEGIN
  SELECT s.starts_on INTO v_starts_on
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_starts_on IS NULL THEN
    RAISE EXCEPTION 'Season starts_on is required for recurring slot scheduling'
      USING ERRCODE = 'P0001';
  END IF;

  v_delta := (p_day_of_week - EXTRACT(DOW FROM v_starts_on)::integer + 7) % 7;
  v_anchor := v_starts_on + (v_delta || ' days')::interval;
  v_anchor := v_anchor + ((GREATEST(p_round_number, 1) - 1) * 7 || ' days')::interval;

  v_local := v_anchor + p_start_time;
  RETURN v_local AT TIME ZONE 'America/Mexico_City';
END;
$$;

REVOKE ALL ON FUNCTION public.__round_slot_starts_at(uuid, integer, integer, time)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_recurring_slot_to_season(
  p_season_id uuid,
  p_day_of_week integer,
  p_start_time time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_field_id uuid;
  v_match record;
  v_starts_at timestamptz;
  v_scheduled integer := 0;
  v_skipped integer := 0;
  v_failed jsonb := '[]'::jsonb;
  v_match_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL OR p_day_of_week IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Season, day_of_week and start_time are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_day_of_week NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'day_of_week must be between 0 and 6'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_match_count
  FROM public.matches m
  WHERE m.season_id = p_season_id;

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'Season has no fixture matches'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT sr.recurring_slot_field_id INTO v_field_id
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_field_id IS NULL THEN
    RAISE EXCEPTION 'Configure recurring_slot_field_id on season_rules before applying recurring slot'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_rules
  SET
    recurring_slot_day_of_week = p_day_of_week,
    recurring_slot_start_time = p_start_time
  WHERE season_id = p_season_id
    AND organization_id = v_org;

  FOR v_match IN
    SELECT m.id, m.round_number, m.field_reservation_id
    FROM public.matches m
    WHERE m.season_id = p_season_id
      AND m.field_reservation_id IS NULL
      AND m.round_number IS NOT NULL
    ORDER BY m.round_number, m.sequence_in_round NULLS LAST, m.id
  LOOP
    BEGIN
      v_starts_at := public.__round_slot_starts_at(
        p_season_id,
        v_match.round_number,
        p_day_of_week,
        p_start_time
      );

      PERFORM public.__schedule_match_core(
        v_match.id,
        v_field_id,
        v_starts_at,
        'programado'
      );

      v_scheduled := v_scheduled + 1;
    EXCEPTION
      WHEN others THEN
        v_failed := v_failed || jsonb_build_object(
          'match_id', v_match.id,
          'error', SQLERRM
        );
    END;
  END LOOP;

  SELECT COUNT(*) INTO v_skipped
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND m.field_reservation_id IS NOT NULL;

  RETURN jsonb_build_object(
    'scheduled', v_scheduled,
    'skipped_already_scheduled', v_skipped,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_recurring_slot_to_season(uuid, integer, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_recurring_slot_to_season(uuid, integer, time) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public matches: expose calendar_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_season_matches(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  round_label text,
  round_number integer,
  sequence_in_round integer,
  home_team_name text,
  away_team_name text,
  status text,
  calendar_status text,
  home_score integer,
  away_score integer,
  starts_at timestamptz,
  venue_name text,
  field_name text
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
    m.round_label,
    m.round_number,
    m.sequence_in_round,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name) AS home_team_name,
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name) AS away_team_name,
    m.status,
    m.calendar_status,
    m.home_score,
    m.away_score,
    fr.starts_at,
    v.name AS venue_name,
    f.name AS field_name
  FROM public.matches m
  JOIN public.season_teams sth ON sth.id = m.home_season_team_id
  JOIN public.teams th ON th.id = sth.team_id
  JOIN public.season_teams sta ON sta.id = m.away_season_team_id
  JOIN public.teams ta ON ta.id = sta.team_id
  LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  LEFT JOIN public.fields f ON f.id = fr.field_id
  LEFT JOIN public.venues v ON v.id = f.venue_id
  WHERE m.season_id = v_season_id
  ORDER BY
    m.round_number NULLS LAST,
    m.sequence_in_round NULLS LAST,
    fr.starts_at NULLS LAST,
    m.created_at ASC,
    m.id ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: captain read matches; reschedule requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.captain_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select_active_captain
  ON public.matches FOR SELECT TO authenticated
  USING (
    public.is_active_captain_of_season_team(home_season_team_id)
    OR public.is_active_captain_of_season_team(away_season_team_id)
  );

CREATE POLICY captain_invitations_select_owner_admin
  ON public.captain_invitations FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY captain_invitations_select_invitee
  ON public.captain_invitations FOR SELECT TO authenticated
  USING (
    lower(email) = lower((
      SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()
    ))
  );

CREATE POLICY match_reschedule_requests_select_owner_admin
  ON public.match_reschedule_requests FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY match_reschedule_requests_select_captain
  ON public.match_reschedule_requests FOR SELECT TO authenticated
  USING (
    public.is_active_captain_of_match(match_id)
  );

REVOKE ALL ON TABLE public.captain_invitations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.match_reschedule_requests FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.captain_invitations TO authenticated;
GRANT SELECT ON TABLE public.match_reschedule_requests TO authenticated;

COMMENT ON TABLE public.match_reschedule_requests IS
  'Captain-initiated reschedule proposals with opponent consensus and admin confirmation.';
COMMENT ON TABLE public.captain_invitations IS
  'Email invitation to link an Auth profile to a captain roster player (no pre-created Auth user).';
