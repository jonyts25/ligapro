-- Migration 024: optional player photo + private storage + virtual credential access
-- ADR: docs/ADR/0010-foto-jugador-credencial-virtual.md

-- ---------------------------------------------------------------------------
-- 1. players.photo_path
-- ---------------------------------------------------------------------------
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS photo_path text;

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_photo_path_format;

ALTER TABLE public.players
  ADD CONSTRAINT players_photo_path_format
  CHECK (
    photo_path IS NULL
    OR (
      photo_path !~ '\.\.'
      AND photo_path !~ '^/'
      AND photo_path ~ (
        '^'
        || organization_id::text
        || '/'
        || id::text
        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
      )
    )
  );

COMMENT ON COLUMN public.players.photo_path IS
  'Private Storage path in bucket player-photos. Never a public URL.';

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_player_photo_path(
  p_organization_id uuid,
  p_player_id uuid,
  p_photo_path text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    p_photo_path IS NOT NULL
    AND p_photo_path !~ '\.\.'
    AND p_photo_path !~ '^/'
    AND p_photo_path ~ (
      '^'
      || p_organization_id::text
      || '/'
      || p_player_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    );
$$;

CREATE OR REPLACE FUNCTION public.__can_set_player_photo(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_player_id
      AND (
        public.has_role_in_org(
          p.organization_id,
          ARRAY['organization_owner', 'organization_admin']::text[]
        )
        OR EXISTS (
          SELECT 1
          FROM public.season_team_players stp
          WHERE stp.player_id = p_player_id
            AND stp.registration_status = 'active'
            AND public.is_active_captain_or_vice_of_season_team(
              stp.season_team_id,
              auth.uid()
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_player_photo(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_player_id
      AND (
        public.has_role_in_org(
          p.organization_id,
          ARRAY['organization_owner', 'organization_admin']::text[]
        )
        OR (
          public.is_member_of(p.organization_id)
          AND NOT EXISTS (
            SELECT 1
            FROM public.season_roles sr
            WHERE sr.organization_id = p.organization_id
              AND sr.profile_id = auth.uid()
              AND sr.role IN ('referee', 'delegate', 'scorekeeper')
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.season_team_players stp
          WHERE stp.player_id = p_player_id
            AND stp.registration_status = 'active'
            AND public.is_active_captain_or_vice_of_season_team(
              stp.season_team_id,
              auth.uid()
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.match_officials mo
          JOIN public.matches m ON m.id = mo.match_id
          JOIN public.season_team_players stp
            ON stp.season_team_id IN (m.home_season_team_id, m.away_season_team_id)
          WHERE mo.profile_id = auth.uid()
            AND mo.status = 'confirmed'
            AND mo.role IN ('referee', 'delegate', 'scorekeeper')
            AND stp.player_id = p_player_id
            AND stp.registration_status IN ('active', 'suspended')
            AND public.has_season_role(
              m.season_id,
              ARRAY['referee', 'delegate', 'scorekeeper']::text[]
            )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC set_player_photo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_player_photo(
  p_player_id uuid,
  p_photo_path text
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

  IF p_player_id IS NULL THEN
    RAISE EXCEPTION 'Player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.__can_set_player_photo(p_player_id) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.organization_id INTO v_org
  FROM public.players p
  WHERE p.id = p_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Player not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_photo_path IS NOT NULL
     AND NOT public.is_valid_player_photo_path(v_org, p_player_id, p_photo_path) THEN
    RAISE EXCEPTION 'Invalid photo_path'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.players
  SET photo_path = p_photo_path
  WHERE id = p_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_player_photo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_photo(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_valid_player_photo_path(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.__can_set_player_photo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_player_photo(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_valid_player_photo_path(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_player_photo(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket: player-photos (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  false,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS player_photos_insert ON storage.objects;
DROP POLICY IF EXISTS player_photos_select ON storage.objects;
DROP POLICY IF EXISTS player_photos_delete ON storage.objects;

CREATE POLICY player_photos_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'player-photos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.is_valid_uuid_text((storage.foldername(name))[2])
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    AND EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.organization_id = ((storage.foldername(name))[1])::uuid
    )
    AND public.__can_set_player_photo(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY player_photos_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.is_valid_uuid_text((storage.foldername(name))[2])
    AND public.can_view_player_photo(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY player_photos_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND public.is_valid_uuid_text((storage.foldername(name))[1])
    AND public.is_valid_uuid_text((storage.foldername(name))[2])
    AND EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.id = ((storage.foldername(name))[2])::uuid
        AND p.organization_id = ((storage.foldername(name))[1])::uuid
    )
    AND public.__can_set_player_photo(((storage.foldername(name))[2])::uuid)
  );
