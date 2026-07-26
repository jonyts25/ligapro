-- Migration 020: discipline adjustment RPCs, vice-captain, captain payment marks
-- Extends 019 captain helpers for vice-captain. Does NOT touch team_charges/team_payments.

-- ---------------------------------------------------------------------------
-- discipline_suspensions: expulsion type + source-event constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.discipline_suspensions
  DROP CONSTRAINT IF EXISTS discipline_suspensions_type_check;
ALTER TABLE public.discipline_suspensions
  ADD CONSTRAINT discipline_suspensions_type_check CHECK (
    suspension_type IN ('direct_red', 'accumulation', 'administrative', 'expulsion')
  );

ALTER TABLE public.discipline_suspensions
  DROP CONSTRAINT IF EXISTS discipline_suspensions_source_event_required_check;
ALTER TABLE public.discipline_suspensions
  ADD CONSTRAINT discipline_suspensions_source_event_required_check CHECK (
    (
      suspension_type IN ('administrative', 'expulsion')
      AND source_match_event_id IS NULL
    )
    OR (
      suspension_type NOT IN ('administrative', 'expulsion')
      AND source_match_event_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS discipline_suspensions_update_owner_or_admin
  ON public.discipline_suspensions;
DROP POLICY IF EXISTS discipline_suspensions_delete_owner_or_admin
  ON public.discipline_suspensions;

REVOKE UPDATE, DELETE ON TABLE public.discipline_suspensions FROM authenticated;

-- ---------------------------------------------------------------------------
-- season_team_players: vice-captain
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_team_players
  ADD COLUMN IF NOT EXISTS is_vice_captain boolean NOT NULL DEFAULT false;

ALTER TABLE public.season_team_players
  DROP CONSTRAINT IF EXISTS season_team_players_captain_and_vice_exclusive_check;
ALTER TABLE public.season_team_players
  ADD CONSTRAINT season_team_players_captain_and_vice_exclusive_check CHECK (
    NOT (is_captain AND is_vice_captain)
  );

ALTER TABLE public.season_team_players
  DROP CONSTRAINT IF EXISTS season_team_players_vice_captain_must_be_active_check;
ALTER TABLE public.season_team_players
  ADD CONSTRAINT season_team_players_vice_captain_must_be_active_check CHECK (
    NOT is_vice_captain OR registration_status = 'active'
  );

CREATE UNIQUE INDEX IF NOT EXISTS season_team_players_one_vice_captain_per_team
  ON public.season_team_players (season_team_id)
  WHERE is_vice_captain = true;

COMMENT ON COLUMN public.season_team_players.is_vice_captain IS
  'At most one active vice-captain per season_team. Same reschedule privileges as captain when profile linked (Migration 020).';

-- ---------------------------------------------------------------------------
-- season_team_player_payment_marks (informal captain ledger; not official finance)
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_team_player_payment_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_player_id uuid NOT NULL REFERENCES public.season_team_players (id) ON DELETE CASCADE,
  marked_paid boolean NOT NULL DEFAULT false,
  marked_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_team_player_payment_marks_stp_unique UNIQUE (season_team_player_id)
);

CREATE INDEX season_team_player_payment_marks_organization_id_idx
  ON public.season_team_player_payment_marks (organization_id);

CREATE TRIGGER season_team_player_payment_marks_set_updated_at
  BEFORE UPDATE ON public.season_team_player_payment_marks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.season_team_player_payment_marks_enforce_org_consistency()
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
      'season_team_player_payment_marks.organization_id must match season_team_players.organization_id'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_team_player_payment_marks_enforce_org_consistency
  BEFORE INSERT OR UPDATE OF organization_id, season_team_player_id
  ON public.season_team_player_payment_marks
  FOR EACH ROW
  EXECUTE FUNCTION public.season_team_player_payment_marks_enforce_org_consistency();

COMMENT ON TABLE public.season_team_player_payment_marks IS
  'Informal paid/unpaid marks by captain/vice-captain only. Not linked to team_charges/team_payments.';

-- ---------------------------------------------------------------------------
-- Helpers: captain OR vice-captain (extends 019; names kept for compatibility)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_captain_or_vice_of_season_team(
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
      AND (stp.is_captain = true OR stp.is_vice_captain = true)
      AND stp.registration_status = 'active'
      AND p.profile_id IS NOT NULL
      AND p.profile_id = p_profile_id
  );
$$;

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
  SELECT public.is_active_captain_or_vice_of_season_team(p_season_team_id, p_profile_id);
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
        public.is_active_captain_or_vice_of_season_team(m.home_season_team_id, p_profile_id)
        OR public.is_active_captain_or_vice_of_season_team(m.away_season_team_id, p_profile_id)
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
    AND (stp.is_captain = true OR stp.is_vice_captain = true)
    AND stp.registration_status = 'active'
    AND p.profile_id = p_profile_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_active_captain_or_vice_of_season_team(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_captain_or_vice_of_season_team(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.is_team_leader_for_roster_player(
  p_season_team_player_id uuid,
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
    FROM public.season_team_players target
    JOIN public.season_team_players leader
      ON leader.season_team_id = target.season_team_id
    JOIN public.players p ON p.id = leader.player_id
    WHERE target.id = p_season_team_player_id
      AND leader.registration_status = 'active'
      AND (leader.is_captain = true OR leader.is_vice_captain = true)
      AND p.profile_id IS NOT NULL
      AND p.profile_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_team_leader_for_roster_player(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_leader_for_roster_player(uuid, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- set_season_team_vice_captain
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_season_team_vice_captain(
  p_season_team_id uuid,
  p_player_id uuid
)
RETURNS public.season_team_players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_row public.season_team_players;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Only organization_owner or organization_admin can set vice-captain'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.* INTO v_row
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION
      'Player % is not on the roster of season_team %',
      p_player_id,
      p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.registration_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION
      'Player % must have registration_status = active to be vice-captain (current: %)',
      p_player_id,
      v_row.registration_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_team_players
  SET is_vice_captain = false
  WHERE season_team_id = p_season_team_id
    AND is_vice_captain = true
    AND player_id IS DISTINCT FROM p_player_id;

  UPDATE public.season_team_players
  SET
    is_vice_captain = true,
    is_captain = false,
    registration_status = 'active'
  WHERE season_team_id = p_season_team_id
    AND player_id = p_player_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_season_team_vice_captain(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_team_vice_captain(uuid, uuid) TO authenticated;

-- Clear vice-captain on status change (captain clear already exists in 015)
CREATE OR REPLACE FUNCTION public.set_season_team_player_status(
  p_season_team_player_id uuid,
  p_registration_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_status text;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := NULLIF(btrim(COALESCE(p_registration_status, '')), '');
  IF v_status IS NULL OR v_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id INTO v_org_id
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('inactive', 'suspended') THEN
    UPDATE public.season_team_players
    SET
      registration_status = v_status,
      is_captain = false,
      is_vice_captain = false
    WHERE id = p_season_team_player_id
      AND organization_id = v_org_id;
  ELSE
    UPDATE public.season_team_players
    SET registration_status = v_status
    WHERE id = p_season_team_player_id
      AND organization_id = v_org_id;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update roster status'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- set_season_team_captain: clear vice flag on new captain
CREATE OR REPLACE FUNCTION public.set_season_team_captain(
  p_season_team_id uuid,
  p_player_id uuid
)
RETURNS public.season_team_players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_row public.season_team_players;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team % does not exist', p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Only organization_owner or organization_admin can set captain'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.* INTO v_row
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION
      'Player % is not on the roster of season_team %',
      p_player_id,
      p_season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.registration_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION
      'Player % must have registration_status = active to be captain (current: %)',
      p_player_id,
      v_row.registration_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_team_players
  SET is_captain = false
  WHERE season_team_id = p_season_team_id
    AND is_captain = true
    AND player_id IS DISTINCT FROM p_player_id;

  UPDATE public.season_team_players
  SET
    is_captain = true,
    is_vice_captain = false,
    registration_status = 'active'
  WHERE season_team_id = p_season_team_id
    AND player_id = p_player_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- invite_captain_to_roster: also accepts vice-captain roster rows (table name unchanged)
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
  v_is_leader boolean;
  v_invitation_id uuid;
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

  SELECT
    stp.organization_id,
    (stp.is_captain = true OR stp.is_vice_captain = true)
  INTO v_org, v_is_leader
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

  IF NOT COALESCE(v_is_leader, false) THEN
    RAISE EXCEPTION 'Player must be marked as captain or vice-captain before sending invitation'
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

-- ---------------------------------------------------------------------------
-- Discipline adjustment RPCs (owner/admin; reason required)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waive_discipline_suspension(
  p_suspension_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_reason text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ds.organization_id INTO v_org
  FROM public.discipline_suspensions ds
  WHERE ds.id = p_suspension_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Suspension not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.discipline_suspensions
  SET
    status = 'waived',
    notes = v_reason
  WHERE id = p_suspension_id
    AND organization_id = v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_discipline_suspension_length(
  p_suspension_id uuid,
  p_matches_remaining integer,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_reason text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_matches_remaining IS NULL OR p_matches_remaining < 0 THEN
    RAISE EXCEPTION 'matches_remaining must be >= 0'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ds.organization_id INTO v_org
  FROM public.discipline_suspensions ds
  WHERE ds.id = p_suspension_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Suspension not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.discipline_suspensions
  SET
    matches_remaining = p_matches_remaining,
    notes = v_reason
  WHERE id = p_suspension_id
    AND organization_id = v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_administrative_suspension(
  p_season_team_player_id uuid,
  p_suspension_type text,
  p_matches_remaining integer,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_type text;
  v_reason text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_type := NULLIF(btrim(COALESCE(p_suspension_type, '')), '');
  IF v_type IS NULL OR v_type NOT IN ('administrative', 'expulsion') THEN
    RAISE EXCEPTION 'suspension_type must be administrative or expulsion'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_matches_remaining IS NULL OR p_matches_remaining < 0 THEN
    RAISE EXCEPTION 'matches_remaining must be >= 0'
      USING ERRCODE = 'P0001';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id INTO v_org
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

  INSERT INTO public.discipline_suspensions (
    organization_id,
    season_team_player_id,
    source_match_event_id,
    suspension_type,
    matches_remaining,
    status,
    notes
  ) VALUES (
    v_org,
    p_season_team_player_id,
    NULL,
    v_type,
    p_matches_remaining,
    'active',
    v_reason
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.waive_discipline_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_discipline_suspension_length(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_administrative_suspension(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waive_discipline_suspension(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_discipline_suspension_length(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_administrative_suspension(uuid, text, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- set_player_payment_mark
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_player_payment_mark(
  p_season_team_player_id uuid,
  p_marked_paid boolean,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_season_team uuid;
  v_notes text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL OR p_marked_paid IS NULL THEN
    RAISE EXCEPTION 'Season team player id and marked_paid are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id, stp.season_team_id
  INTO v_org, v_season_team
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_or_vice_of_season_team(v_season_team, v_uid) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  INSERT INTO public.season_team_player_payment_marks (
    organization_id,
    season_team_player_id,
    marked_paid,
    marked_by_profile_id,
    notes
  ) VALUES (
    v_org,
    p_season_team_player_id,
    p_marked_paid,
    v_uid,
    v_notes
  )
  ON CONFLICT (season_team_player_id) DO UPDATE
  SET
    marked_paid = EXCLUDED.marked_paid,
    marked_by_profile_id = EXCLUDED.marked_by_profile_id,
    notes = EXCLUDED.notes
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_player_payment_mark(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_payment_mark(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS updates
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS matches_select_active_captain ON public.matches;
CREATE POLICY matches_select_active_captain
  ON public.matches FOR SELECT TO authenticated
  USING (
    public.is_active_captain_or_vice_of_season_team(home_season_team_id)
    OR public.is_active_captain_or_vice_of_season_team(away_season_team_id)
  );

DROP POLICY IF EXISTS match_reschedule_requests_select_captain
  ON public.match_reschedule_requests;
CREATE POLICY match_reschedule_requests_select_captain
  ON public.match_reschedule_requests FOR SELECT TO authenticated
  USING (
    public.is_active_captain_of_match(match_id)
  );

ALTER TABLE public.season_team_player_payment_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_team_player_payment_marks_select_owner_admin
  ON public.season_team_player_payment_marks FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY season_team_player_payment_marks_select_team_leader
  ON public.season_team_player_payment_marks FOR SELECT TO authenticated
  USING (
    public.is_team_leader_for_roster_player(season_team_player_id)
  );

CREATE POLICY season_team_player_payment_marks_insert_team_leader
  ON public.season_team_player_payment_marks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_leader_for_roster_player(season_team_player_id)
    AND organization_id = (
      SELECT stp.organization_id
      FROM public.season_team_players stp
      WHERE stp.id = season_team_player_id
    )
  );

CREATE POLICY season_team_player_payment_marks_update_team_leader
  ON public.season_team_player_payment_marks FOR UPDATE TO authenticated
  USING (
    public.is_team_leader_for_roster_player(season_team_player_id)
  )
  WITH CHECK (
    public.is_team_leader_for_roster_player(season_team_player_id)
    AND organization_id = (
      SELECT stp.organization_id
      FROM public.season_team_players stp
      WHERE stp.id = season_team_player_id
    )
  );

REVOKE ALL ON TABLE public.season_team_player_payment_marks FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.season_team_player_payment_marks TO authenticated;
