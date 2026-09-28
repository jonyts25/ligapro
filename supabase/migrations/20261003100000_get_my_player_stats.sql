-- Migration 044 (step 3.3): player self-service stats RPC

CREATE OR REPLACE FUNCTION public.get_my_player_stats(
  p_season_team_player_ids uuid[]
)
RETURNS TABLE (
  season_team_player_id uuid,
  matches_played integer,
  goals integer,
  assists integer,
  own_goals integer,
  yellow_cards integer,
  red_cards integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    stp.id AS season_team_player_id,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_participants mp
      WHERE mp.season_team_player_id = stp.id
        AND mp.status = 'played'
    ), 0) AS matches_played,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_events me
      WHERE me.season_team_player_id = stp.id
        AND me.event_type = 'goal'
        AND me.voided_at IS NULL
    ), 0) AS goals,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_events me
      WHERE me.assist_season_team_player_id = stp.id
        AND me.event_type = 'goal'
        AND me.voided_at IS NULL
    ), 0) AS assists,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_events me
      WHERE me.season_team_player_id = stp.id
        AND me.event_type = 'own_goal'
        AND me.voided_at IS NULL
    ), 0) AS own_goals,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_events me
      WHERE me.season_team_player_id = stp.id
        AND me.event_type = 'yellow_card'
        AND me.voided_at IS NULL
    ), 0) AS yellow_cards,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_events me
      WHERE me.season_team_player_id = stp.id
        AND me.event_type = 'red_card'
        AND me.voided_at IS NULL
    ), 0) AS red_cards
  FROM public.season_team_players stp
  JOIN public.players p ON p.id = stp.player_id
  WHERE stp.id = ANY(p_season_team_player_ids)
    AND p.profile_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_player_stats(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_player_stats(uuid[]) TO authenticated;

-- Step 3.3 finding: claimed players could not view their own photo via can_view_player_photo.
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
        p.profile_id = auth.uid()
        OR public.has_role_in_org(
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
