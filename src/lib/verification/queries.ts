import { createClient } from "@/lib/supabase/server";

export type PendingVerificationPlayer = {
  playerId: string;
  fullName: string;
  teamName: string;
  seasonTeamId: string;
  jerseyNumber: number | null;
};

export async function getPendingVerificationPlayers(
  organizationId: string,
  seasonId: string
): Promise<PendingVerificationPlayer[]> {
  const supabase = await createClient();

  const { data: rosterRows } = await supabase
    .from("season_team_players")
    .select(
      "id, season_team_id, jersey_number, player_id, players!inner(full_name, verification_status), season_teams(display_name, teams(name))"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("players.verification_status", "pending")
    .neq("registration_status", "inactive")
    .order("updated_at", { ascending: false });

  const seen = new Set<string>();
  const result: PendingVerificationPlayer[] = [];

  for (const row of rosterRows ?? []) {
    if (seen.has(row.player_id)) continue;
    seen.add(row.player_id);

    const playerRel = row.players as
      | { full_name: string; verification_status: string }
      | { full_name: string; verification_status: string }[]
      | null;
    const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;

    const stRel = row.season_teams as
      | {
          display_name: string | null;
          teams: { name: string } | { name: string }[] | null;
        }
      | {
          display_name: string | null;
          teams: { name: string } | { name: string }[] | null;
        }[]
      | null;
    const seasonTeam = Array.isArray(stRel) ? stRel[0] : stRel;
    const teamRel = seasonTeam?.teams;
    const team = Array.isArray(teamRel) ? teamRel[0] : teamRel;

    result.push({
      playerId: row.player_id,
      fullName: player?.full_name ?? "Jugador",
      teamName: seasonTeam?.display_name?.trim() || team?.name || "Equipo",
      seasonTeamId: row.season_team_id,
      jerseyNumber: row.jersey_number,
    });
  }

  return result;
}
