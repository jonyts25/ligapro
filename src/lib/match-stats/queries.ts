import { createClient } from "@/lib/supabase/server";
import { getMatchSchedulingDetails } from "@/lib/fixtures/queries";
import type { MatchStatsCaptureContext } from "@/lib/match-stats/types";

export async function getMatchStatsCaptureContext(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string,
  userId: string,
  orgRole: string
): Promise<(MatchStatsCaptureContext & {
  homeName: string;
  awayName: string;
}) | null> {
  const details = await getMatchSchedulingDetails(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );
  if (!details) return null;

  const match = details.match;
  const supabase = await createClient();

  const [{ data: teamStats }, { data: contextRow }, { data: canCapture }] =
    await Promise.all([
      supabase
        .from("match_team_stats")
        .select(
          "season_team_id, shots, shots_on_target, possession_pct, corners, fouls, offsides"
        )
        .eq("match_id", matchId)
        .eq("organization_id", organizationId),
      supabase
        .from("match_context")
        .select("attendance, weather, referee_name, highlight_note")
        .eq("match_id", matchId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase.rpc("can_capture_match", { p_match_id: matchId }),
    ]);

  const statsByTeam = new Map(
    (teamStats ?? []).map((row) => [row.season_team_id, row])
  );

  function teamRow(
    seasonTeamId: string,
    teamName: string
  ): MatchStatsCaptureContext["home"] {
    const row = statsByTeam.get(seasonTeamId);
    return {
      seasonTeamId,
      teamName,
      shots: row?.shots ?? null,
      shotsOnTarget: row?.shots_on_target ?? null,
      possessionPct:
        row?.possession_pct != null ? Number(row.possession_pct) : null,
      corners: row?.corners ?? null,
      fouls: row?.fouls ?? null,
      offsides: row?.offsides ?? null,
    };
  }

  const isOrgAdmin =
    orgRole === "organization_owner" || orgRole === "organization_admin";
  const { data: seasonRoles } = await supabase
    .from("season_roles")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("profile_id", userId);
  const isTournamentAdmin = (seasonRoles ?? []).some(
    (r) => r.role === "tournament_admin"
  );

  return {
    homeName: match.homeName,
    awayName: match.awayName,
    home: teamRow(match.homeSeasonTeamId, match.homeName),
    away: teamRow(match.awaySeasonTeamId, match.awayName),
    context: {
      attendance: contextRow?.attendance ?? null,
      weather: contextRow?.weather ?? null,
      refereeName: contextRow?.referee_name ?? null,
      highlightNote: contextRow?.highlight_note ?? null,
    },
    canEdit: isOrgAdmin || isTournamentAdmin || Boolean(canCapture),
  };
}
