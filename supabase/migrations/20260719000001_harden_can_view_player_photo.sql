-- Migration 024b: officials with season roles use match-scoped photo access only

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
