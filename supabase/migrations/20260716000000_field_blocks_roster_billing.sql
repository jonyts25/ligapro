-- Migration 021: captain read RLS, profiles.phone, season_field_blocks,
-- registration fee, delegated roster add, single vice-captain designation,
-- platform billing lock.

-- ---------------------------------------------------------------------------
-- 0. Captain portal blockers (frontend e5ed883)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS
  'Optional contact phone for captain WhatsApp deep-links. E.164 validated in client only.';

CREATE POLICY season_teams_select_team_leader
  ON public.season_teams FOR SELECT TO authenticated
  USING (
    public.is_active_captain_or_vice_of_season_team(id)
  );

CREATE POLICY season_team_players_select_team_leader
  ON public.season_team_players FOR SELECT TO authenticated
  USING (
    public.is_active_captain_or_vice_of_season_team(season_team_id)
  );

CREATE POLICY field_reservations_select_team_leader
  ON public.field_reservations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.field_reservation_id = field_reservations.id
        AND (
          public.is_active_captain_or_vice_of_season_team(m.home_season_team_id)
          OR public.is_active_captain_or_vice_of_season_team(m.away_season_team_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 1. season_field_blocks
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_field_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.fields (id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_field_blocks_day_of_week_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT season_field_blocks_time_range_check CHECK (ends_at > starts_at)
);

CREATE INDEX season_field_blocks_organization_id_idx
  ON public.season_field_blocks (organization_id);
CREATE INDEX season_field_blocks_season_id_idx
  ON public.season_field_blocks (season_id);
CREATE INDEX season_field_blocks_field_id_idx
  ON public.season_field_blocks (field_id);

CREATE TRIGGER season_field_blocks_set_updated_at
  BEFORE UPDATE ON public.season_field_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.season_field_blocks_enforce_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_org uuid;
  v_field_org uuid;
BEGIN
  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT f.organization_id INTO v_field_org
  FROM public.fields f
  WHERE f.id = NEW.field_id;

  IF v_field_org IS NULL THEN
    RAISE EXCEPTION 'Field % does not exist', NEW.field_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org
     OR NEW.organization_id IS DISTINCT FROM v_field_org THEN
    RAISE EXCEPTION
      'season_field_blocks.organization_id must match season and field organization'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_field_blocks_enforce_org_consistency
  BEFORE INSERT OR UPDATE OF organization_id, season_id, field_id
  ON public.season_field_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.season_field_blocks_enforce_org_consistency();

-- Same-season overlap on same field/day (cross-day blocks allowed, e.g. Thu + Sun).
ALTER TABLE public.season_field_blocks
  ADD CONSTRAINT no_overlapping_season_field_blocks_same_season
  EXCLUDE USING gist (
    field_id WITH =,
    day_of_week WITH =,
    season_id WITH =,
    tsrange(
      ('2000-01-01'::date + starts_at),
      ('2000-01-01'::date + ends_at)
    ) WITH &&
  );

CREATE OR REPLACE FUNCTION public.season_field_blocks_enforce_cross_season_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.season_field_blocks b
    WHERE b.field_id = NEW.field_id
      AND b.day_of_week = NEW.day_of_week
      AND b.season_id <> NEW.season_id
      AND tsrange(
            ('2000-01-01'::date + b.starts_at),
            ('2000-01-01'::date + b.ends_at)
          )
        && tsrange(
            ('2000-01-01'::date + NEW.starts_at),
            ('2000-01-01'::date + NEW.ends_at)
          )
      AND (TG_OP = 'INSERT' OR b.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION
      'Field block overlaps with a block reserved for another season'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_field_blocks_cross_season_overlap
  BEFORE INSERT OR UPDATE OF field_id, season_id, day_of_week, starts_at, ends_at
  ON public.season_field_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.season_field_blocks_enforce_cross_season_overlap();

COMMENT ON TABLE public.season_field_blocks IS
  'Season-scoped field time reservations for tournaments. Separate from field_reservations (match slots).';

-- ---------------------------------------------------------------------------
-- set_season_field_blocks — atomic replace per season
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_season_field_blocks(
  p_season_id uuid,
  p_blocks jsonb
)
RETURNS SETOF public.season_field_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_elem jsonb;
  v_idx integer := 0;
  v_i integer;
  v_j integer;
  v_len integer;
  v_field_id uuid;
  v_day integer;
  v_starts time;
  v_ends time;
  v_fields uuid[];
  v_days integer[];
  v_starts_arr time[];
  v_ends_arr time[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_blocks IS NULL OR jsonb_typeof(p_blocks) <> 'array' THEN
    RAISE EXCEPTION 'Blocks must be a JSON array'
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

  v_len := jsonb_array_length(p_blocks);

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_blocks)
  LOOP
    v_idx := v_idx + 1;

    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each block must be a JSON object'
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_field_id := (v_elem ->> 'field_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid field_id in block %', v_idx
        USING ERRCODE = 'P0001';
    END;

    IF v_field_id IS NULL THEN
      RAISE EXCEPTION 'field_id is required in block %', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.fields f
      WHERE f.id = v_field_id
        AND f.organization_id = v_org
    ) THEN
      RAISE EXCEPTION 'Field % does not belong to this organization', v_field_id
        USING ERRCODE = 'P0001';
    END IF;

    v_day := (v_elem ->> 'day_of_week')::integer;
    IF v_day IS NULL OR v_day < 0 OR v_day > 6 THEN
      RAISE EXCEPTION 'day_of_week must be between 0 and 6 in block %', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_starts := (v_elem ->> 'starts_at')::time;
      v_ends := (v_elem ->> 'ends_at')::time;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid time format in block %', v_idx
        USING ERRCODE = 'P0001';
    END;

    IF v_ends <= v_starts THEN
      RAISE EXCEPTION 'ends_at must be after starts_at in block %', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    v_fields := array_append(v_fields, v_field_id);
    v_days := array_append(v_days, v_day);
    v_starts_arr := array_append(v_starts_arr, v_starts);
    v_ends_arr := array_append(v_ends_arr, v_ends);
  END LOOP;

  IF v_len > 1 THEN
    FOR v_i IN 1 .. v_len LOOP
      FOR v_j IN (v_i + 1) .. v_len LOOP
        IF v_fields[v_i] = v_fields[v_j]
           AND v_days[v_i] = v_days[v_j]
           AND tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_i]),
                 ('2000-01-01'::date + v_ends_arr[v_i])
               )
             && tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_j]),
                 ('2000-01-01'::date + v_ends_arr[v_j])
               )
        THEN
          RAISE EXCEPTION 'Overlapping blocks in payload for the same field and day'
            USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  DELETE FROM public.season_field_blocks
  WHERE season_id = p_season_id
    AND organization_id = v_org;

  IF v_len > 0 THEN
    FOR v_i IN 1 .. v_len LOOP
      INSERT INTO public.season_field_blocks (
        organization_id,
        season_id,
        field_id,
        day_of_week,
        starts_at,
        ends_at
      ) VALUES (
        v_org,
        p_season_id,
        v_fields[v_i],
        v_days[v_i],
        v_starts_arr[v_i],
        v_ends_arr[v_i]
      );
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT b.*
  FROM public.season_field_blocks b
  WHERE b.season_id = p_season_id
  ORDER BY b.field_id, b.day_of_week, b.starts_at;
END;
$$;

REVOKE ALL ON FUNCTION public.set_season_field_blocks(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_field_blocks(uuid, jsonb) TO authenticated;

ALTER TABLE public.season_field_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_field_blocks_select_member
  ON public.season_field_blocks FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.season_field_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.season_field_blocks TO authenticated;

-- ---------------------------------------------------------------------------
-- Field block check for match scheduling
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__assert_field_slot_not_blocked_by_other_season(
  p_field_id uuid,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_season_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.season_field_blocks b
    WHERE b.field_id = p_field_id
      AND b.day_of_week = p_day_of_week
      AND b.season_id <> p_season_id
      AND tsrange(
            ('2000-01-01'::date + b.starts_at),
            ('2000-01-01'::date + b.ends_at)
          )
        && tsrange(
            ('2000-01-01'::date + p_start_time),
            ('2000-01-01'::date + p_end_time)
          )
  ) THEN
    RAISE EXCEPTION
      'This field and time slot is reserved for another tournament season'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_field_slot_not_blocked_by_other_season(uuid, integer, time, time, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Registration fee + enroll_team_in_season
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_rules
  ADD COLUMN IF NOT EXISTS registration_fee numeric(12, 2),
  ADD COLUMN IF NOT EXISTS max_roster_size integer;

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_registration_fee_positive_check;

ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_registration_fee_positive_check CHECK (
    registration_fee IS NULL OR registration_fee > 0
  );

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_max_roster_size_positive_check;

ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_max_roster_size_positive_check CHECK (
    max_roster_size IS NULL OR max_roster_size > 0
  );

COMMENT ON COLUMN public.season_rules.registration_fee IS
  'Optional per-team registration fee. enroll_team_in_season creates a team_charge when set.';
COMMENT ON COLUMN public.season_rules.max_roster_size IS
  'Optional cap enforced on captain-initiated roster adds only. Admin bypasses.';

ALTER TABLE public.season_teams
  ADD COLUMN IF NOT EXISTS roster_locked_by_captain boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.season_teams.roster_locked_by_captain IS
  'When true, captain/vice cannot add players. Admin bypasses.';

-- ---------------------------------------------------------------------------
-- 5. Platform billing lock
-- ---------------------------------------------------------------------------
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS platform_billing_status text NOT NULL DEFAULT 'pendiente';

ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS seasons_platform_billing_status_check;

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_platform_billing_status_check CHECK (
    platform_billing_status IN ('pendiente', 'pagado', 'vencido')
  );

COMMENT ON COLUMN public.seasons.platform_billing_status IS
  'LigaPro platform billing gate. Managed via Supabase dashboard only — not app-writable.';

REVOKE UPDATE (platform_billing_status) ON TABLE public.seasons FROM authenticated;

CREATE OR REPLACE FUNCTION public.seasons_prevent_platform_billing_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.platform_billing_status IS DISTINCT FROM OLD.platform_billing_status
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION
      'platform_billing_status cannot be changed through the application'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER seasons_prevent_platform_billing_status_update
  BEFORE UPDATE OF platform_billing_status ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.seasons_prevent_platform_billing_status_update();

CREATE OR REPLACE FUNCTION public.__assert_season_platform_billing_active(p_season_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT s.platform_billing_status INTO v_status
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IS DISTINCT FROM 'pagado' THEN
    RAISE EXCEPTION
      'Esta temporada no tiene facturación activa con LigaPro. Contacta a soporte para activarla.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_platform_billing_active(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Captain roster helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__assert_captain_roster_add_allowed(
  p_season_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
  v_max integer;
  v_active_count integer;
BEGIN
  SELECT st.roster_locked_by_captain, sr.max_roster_size
  INTO v_locked, v_max
  FROM public.season_teams st
  JOIN public.season_rules sr ON sr.season_id = st.season_id
  WHERE st.id = p_season_team_id;

  IF v_locked IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_locked, false) THEN
    RAISE EXCEPTION 'Roster additions by the captain are locked for this team'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.season_team_players stp
    WHERE stp.season_team_id = p_season_team_id
      AND stp.registration_status = 'active';

    IF v_active_count >= v_max THEN
      RAISE EXCEPTION 'Roster has reached the maximum size (% players)', v_max
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_captain_roster_add_allowed(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_roster_lock(
  p_season_team_id uuid,
  p_locked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL OR p_locked IS NULL THEN
    RAISE EXCEPTION 'Season team id and lock flag are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_teams
  SET roster_locked_by_captain = p_locked
  WHERE id = p_season_team_id
    AND organization_id = v_org;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update roster lock'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_roster_lock(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_roster_lock(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- enroll_team_in_season — auto registration charge
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enroll_team_in_season(
  p_season_id uuid,
  p_team_id uuid,
  p_display_name text DEFAULT NULL,
  p_group_name text DEFAULT NULL,
  p_registration_status text DEFAULT 'registered'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_season_org uuid;
  v_team_org uuid;
  v_status text;
  v_display text;
  v_group text;
  v_season_team_id uuid;
  v_registration_fee numeric(12, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL OR p_team_id IS NULL THEN
    RAISE EXCEPTION 'Season id and team id are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT t.organization_id INTO v_team_org
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_team_org IS NULL THEN
    RAISE EXCEPTION 'Team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_season_org IS DISTINCT FROM v_team_org THEN
    RAISE EXCEPTION 'Team and season must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_season_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'registered');
  IF v_status NOT IN ('registered', 'confirmed', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  v_display := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_group := NULLIF(btrim(COALESCE(p_group_name, '')), '');

  IF v_display IS NOT NULL AND char_length(v_display) > 100 THEN
    RAISE EXCEPTION 'Display name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_group IS NOT NULL AND char_length(v_group) > 100 THEN
    RAISE EXCEPTION 'Group name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT sr.registration_fee INTO v_registration_fee
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  INSERT INTO public.season_teams (
    season_id,
    team_id,
    organization_id,
    display_name,
    group_name,
    registration_status
  ) VALUES (
    p_season_id,
    p_team_id,
    v_season_org,
    v_display,
    v_group,
    v_status
  )
  RETURNING id INTO v_season_team_id;

  IF v_registration_fee IS NOT NULL THEN
    INSERT INTO public.team_charges (
      organization_id,
      season_team_id,
      charge_type,
      description,
      amount,
      created_by_profile_id
    ) VALUES (
      v_season_org,
      v_season_team_id,
      'registration',
      'Cuota de inscripción',
      v_registration_fee,
      v_uid
    );
  END IF;

  RETURN v_season_team_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- add_player_to_season_team — captain add (own team only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_player_to_season_team(
  p_season_team_id uuid,
  p_player_id uuid,
  p_jersey_number integer DEFAULT NULL,
  p_registration_status text DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_player_org uuid;
  v_status text;
  v_existing public.season_team_players;
  v_id uuid;
  v_is_admin boolean;
  v_is_leader boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL OR p_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team id and player id are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = p_player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_org_id IS DISTINCT FROM v_player_org THEN
    RAISE EXCEPTION 'Player and season team must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  );
  v_is_leader := public.is_active_captain_or_vice_of_season_team(
    p_season_team_id,
    v_uid
  );

  IF NOT v_is_admin AND NOT v_is_leader THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_leader AND NOT v_is_admin THEN
    PERFORM public.__assert_captain_roster_add_allowed(p_season_team_id);
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'active');
  IF v_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_jersey_number IS NOT NULL AND p_jersey_number <= 0 THEN
    RAISE EXCEPTION 'Jersey number must be greater than zero'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.registration_status = 'active' THEN
      RAISE EXCEPTION 'Player is already on this roster'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.season_team_players
    SET
      registration_status = v_status,
      jersey_number = p_jersey_number,
      is_captain = false,
      is_vice_captain = false
    WHERE id = v_existing.id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  INSERT INTO public.season_team_players (
    season_team_id,
    player_id,
    organization_id,
    jersey_number,
    is_captain,
    registration_status
  ) VALUES (
    p_season_team_id,
    p_player_id,
    v_org_id,
    p_jersey_number,
    false,
    v_status
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_player_and_add_to_roster — captain add (own team only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_player_and_add_to_roster(
  p_season_team_id uuid,
  p_full_name text,
  p_jersey_number integer DEFAULT NULL,
  p_registration_status text DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_name text;
  v_player_id uuid;
  v_stp_id uuid;
  v_is_admin boolean;
  v_is_leader boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Season team id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  );
  v_is_leader := public.is_active_captain_or_vice_of_season_team(
    p_season_team_id,
    v_uid
  );

  IF NOT v_is_admin AND NOT v_is_leader THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_leader AND NOT v_is_admin THEN
    PERFORM public.__assert_captain_roster_add_allowed(p_season_team_id);
  END IF;

  v_name := btrim(COALESCE(p_full_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Player name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.players (organization_id, full_name, profile_id)
  VALUES (v_org_id, v_name, NULL)
  RETURNING id INTO v_player_id;

  v_stp_id := public.add_player_to_season_team(
    p_season_team_id,
    v_player_id,
    p_jersey_number,
    p_registration_status
  );

  RETURN v_stp_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- set_season_team_vice_captain — single designation for captains
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
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_row public.season_team_players;
  v_is_admin boolean;
  v_is_leader boolean;
  v_existing_vice uuid;
BEGIN
  IF v_uid IS NULL THEN
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

  v_is_admin := public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  );
  v_is_leader := public.is_active_captain_or_vice_of_season_team(
    p_season_team_id,
    v_uid
  );

  IF NOT v_is_admin AND NOT v_is_leader THEN
    RAISE EXCEPTION 'Not authorized'
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

  IF NOT v_is_admin THEN
    SELECT stp.player_id INTO v_existing_vice
    FROM public.season_team_players stp
    WHERE stp.season_team_id = p_season_team_id
      AND stp.is_vice_captain = true
      AND stp.registration_status = 'active'
      AND stp.player_id IS DISTINCT FROM p_player_id
    LIMIT 1;

    IF v_existing_vice IS NOT NULL THEN
      RAISE EXCEPTION
        'Vice-captain slot is already filled; contact an administrator to replace'
        USING ERRCODE = 'P0001';
    END IF;
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

-- ---------------------------------------------------------------------------
-- __schedule_match_core — reject foreign season field blocks
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

  PERFORM public.__assert_field_slot_not_blocked_by_other_season(
    p_field_id,
    v_dow,
    v_start_time,
    v_end_time,
    v_season
  );

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

      UPDATE public.matches
      SET field_reservation_id = v_res_id
      WHERE id = p_match_id
        AND organization_id = v_org;
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
-- create_season_round_robin_fixture — platform billing gate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_season_round_robin_fixture(
  p_season_id uuid,
  p_mode text,
  p_matches jsonb
)
RETURNS SETOF public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_mode text;
  v_team_ids uuid[];
  v_n integer;
  v_expected integer;
  v_elem jsonb;
  v_keys text[];
  v_expected_keys text[] := ARRAY[
    'away_season_team_id',
    'home_season_team_id',
    'leg_number',
    'round_number',
    'sequence_in_round'
  ];
  v_round integer;
  v_leg integer;
  v_seq integer;
  v_home uuid;
  v_away uuid;
  v_pair text;
  v_pair_set text[] := ARRAY[]::text[];
  v_pair_counts jsonb := '{}'::jsonb;
  v_pair_homes jsonb := '{}'::jsonb;
  v_round_teams text[];
  v_round_map jsonb := '{}'::jsonb;
  v_count integer;
  v_key text;
  v_homes text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_mode := NULLIF(btrim(COALESCE(p_mode, '')), '');
  IF v_mode IS NULL OR v_mode NOT IN ('single', 'double') THEN
    RAISE EXCEPTION 'Mode must be single or double'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RAISE EXCEPTION 'Matches payload must be a JSON array'
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

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  SELECT COUNT(*) INTO v_count
  FROM public.matches m
  WHERE m.season_id = p_season_id;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Season already has matches; regeneration is not allowed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(st.id ORDER BY st.created_at, st.id), ARRAY[]::uuid[])
  INTO v_team_ids
  FROM public.season_teams st
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
    AND st.registration_status IN ('registered', 'confirmed');

  v_n := COALESCE(array_length(v_team_ids, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'At least two eligible teams are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_expected := CASE
    WHEN v_mode = 'single' THEN v_n * (v_n - 1) / 2
    ELSE v_n * (v_n - 1)
  END;

  IF jsonb_array_length(p_matches) <> v_expected THEN
    RAISE EXCEPTION 'Fixture match count must be % for % teams in % mode',
      v_expected, v_n, v_mode
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each match must be a JSON object'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
    INTO v_keys
    FROM jsonb_object_keys(v_elem) AS k;

    IF v_keys IS DISTINCT FROM v_expected_keys THEN
      RAISE EXCEPTION 'Unexpected or missing match properties'
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_round := (v_elem->>'round_number')::integer;
      v_leg := (v_elem->>'leg_number')::integer;
      v_seq := (v_elem->>'sequence_in_round')::integer;
      v_home := (v_elem->>'home_season_team_id')::uuid;
      v_away := (v_elem->>'away_season_team_id')::uuid;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid match field types'
          USING ERRCODE = 'P0001';
    END;

    IF v_round IS NULL OR v_round <= 0 THEN
      RAISE EXCEPTION 'round_number must be > 0'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_leg IS NULL OR v_leg NOT IN (1, 2) THEN
      RAISE EXCEPTION 'leg_number must be 1 or 2'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_mode = 'single' AND v_leg <> 1 THEN
      RAISE EXCEPTION 'Single mode requires leg_number = 1'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_seq IS NULL OR v_seq <= 0 THEN
      RAISE EXCEPTION 'sequence_in_round must be > 0'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_home IS NULL OR v_away IS NULL THEN
      RAISE EXCEPTION 'home and away season teams are required'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_home = v_away THEN
      RAISE EXCEPTION 'Home and away must be distinct'
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT (v_home = ANY (v_team_ids)) OR NOT (v_away = ANY (v_team_ids)) THEN
      RAISE EXCEPTION 'Season team is not eligible for this season'
        USING ERRCODE = 'P0001';
    END IF;

    v_key := v_round::text;
    v_round_teams := COALESCE(
      (
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_round_map->v_key))
      ),
      ARRAY[]::text[]
    );
    IF v_home::text = ANY (v_round_teams) OR v_away::text = ANY (v_round_teams) THEN
      RAISE EXCEPTION 'A team cannot play twice in the same round'
        USING ERRCODE = 'P0001';
    END IF;
    v_round_teams := v_round_teams || ARRAY[v_home::text, v_away::text];
    v_round_map := jsonb_set(
      v_round_map,
      ARRAY[v_key],
      to_jsonb(v_round_teams),
      true
    );

    IF v_home::text < v_away::text THEN
      v_pair := v_home::text || ':' || v_away::text;
    ELSE
      v_pair := v_away::text || ':' || v_home::text;
    END IF;

    v_count := COALESCE((v_pair_counts->>v_pair)::integer, 0) + 1;
    v_pair_counts := jsonb_set(
      v_pair_counts,
      ARRAY[v_pair],
      to_jsonb(v_count),
      true
    );

    v_homes := COALESCE(
      (
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_pair_homes->v_pair))
      ),
      ARRAY[]::text[]
    );
    v_homes := v_homes || ARRAY[v_home::text];
    v_pair_homes := jsonb_set(
      v_pair_homes,
      ARRAY[v_pair],
      to_jsonb(v_homes),
      true
    );

    IF NOT (v_pair = ANY (v_pair_set)) THEN
      v_pair_set := v_pair_set || ARRAY[v_pair];
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_pair_set, 1), 0) <> (v_n * (v_n - 1) / 2) THEN
    RAISE EXCEPTION 'Fixture must include every unique pair exactly as required'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_pair IN ARRAY v_pair_set
  LOOP
    v_count := COALESCE((v_pair_counts->>v_pair)::integer, 0);
    IF v_mode = 'single' THEN
      IF v_count <> 1 THEN
        RAISE EXCEPTION 'Single mode requires each pair exactly once'
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      IF v_count <> 2 THEN
        RAISE EXCEPTION 'Double mode requires each pair exactly twice'
          USING ERRCODE = 'P0001';
      END IF;
      v_homes := ARRAY(
        SELECT jsonb_array_elements_text(v_pair_homes->v_pair)
      );
      IF array_length(v_homes, 1) <> 2 OR v_homes[1] = v_homes[2] THEN
        RAISE EXCEPTION 'Double mode requires inverted home/away for each pair'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.matches (
    season_id,
    organization_id,
    home_season_team_id,
    away_season_team_id,
    status,
    round_number,
    leg_number,
    sequence_in_round,
    round_label
  )
  SELECT
    p_season_id,
    v_org,
    (e->>'home_season_team_id')::uuid,
    (e->>'away_season_team_id')::uuid,
    'scheduled',
    (e->>'round_number')::integer,
    (e->>'leg_number')::integer,
    (e->>'sequence_in_round')::integer,
    'Jornada ' || (e->>'round_number')
  FROM jsonb_array_elements(p_matches) AS e
  ORDER BY (e->>'round_number')::integer, (e->>'sequence_in_round')::integer;

  RETURN QUERY
  SELECT m.*
  FROM public.matches m
  WHERE m.season_id = p_season_id
  ORDER BY m.round_number NULLS LAST, m.sequence_in_round NULLS LAST, m.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- apply_recurring_slot_to_season — platform billing gate
-- ---------------------------------------------------------------------------
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

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

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
