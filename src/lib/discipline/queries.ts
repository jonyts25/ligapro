import { createClient } from "@/lib/supabase/server";
import { displaySeasonTeamName } from "@/lib/teams/types";
import type {
  ActiveSuspensionRow,
  RosterPlayerOption,
} from "@/lib/discipline/types";

export async function getActiveDisciplineSuspensions(
  organizationId: string,
  seasonId: string
): Promise<ActiveSuspensionRow[]> {
  const supabase = await createClient();

  const { data: seasonTeams } = await supabase
    .from("season_teams")
    .select("id, display_name, teams(name)")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  if (!seasonTeams?.length) return [];

  const teamNames = new Map<string, string>();
  for (const team of seasonTeams) {
    const rel = team.teams as { name: string } | { name: string }[] | null;
    const teamName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    teamNames.set(
      team.id,
      displaySeasonTeamName(team.display_name, teamName ?? "Equipo")
    );
  }

  const seasonTeamIds = seasonTeams.map((t) => t.id);

  const { data: stps } = await supabase
    .from("season_team_players")
    .select(
      "id, season_team_id, players(full_name), season_teams(display_name, teams(name))"
    )
    .eq("organization_id", organizationId)
    .in("season_team_id", seasonTeamIds);

  const stpMeta = new Map<
    string,
    { playerName: string; teamName: string }
  >();
  for (const row of stps ?? []) {
    const playerRel = row.players as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    const playerName = Array.isArray(playerRel)
      ? playerRel[0]?.full_name
      : playerRel?.full_name;
    const stRel = row.season_teams as
      | {
          display_name: string | null;
          teams: { name: string } | { name: string }[] | null;
        }
      | null
      | Array<unknown>;
    const st = Array.isArray(stRel) ? null : stRel;
    const teamRel = st?.teams ?? null;
    const baseTeam = Array.isArray(teamRel) ? teamRel[0]?.name : teamRel?.name;
    stpMeta.set(row.id, {
      playerName: playerName ?? "Jugador",
      teamName: displaySeasonTeamName(st?.display_name ?? null, baseTeam ?? "Equipo"),
    });
  }

  const stpIds = [...stpMeta.keys()];
  if (!stpIds.length) return [];

  const { data: suspensions } = await supabase
    .from("discipline_suspensions")
    .select(
      "id, season_team_player_id, suspension_type, matches_remaining, matches_served, status, notes"
    )
    .eq("organization_id", organizationId)
    .in("season_team_player_id", stpIds)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (suspensions ?? []).map((row) => {
    const meta = stpMeta.get(row.season_team_player_id);
    return {
      id: row.id,
      seasonTeamPlayerId: row.season_team_player_id,
      playerName: meta?.playerName ?? "Jugador",
      teamName: meta?.teamName ?? "Equipo",
      suspensionType: row.suspension_type,
      matchesRemaining: row.matches_remaining,
      matchesServed: row.matches_served,
      status: row.status,
      notes: row.notes,
    };
  });
}

export async function getSeasonRosterPlayerOptions(
  organizationId: string,
  seasonId: string
): Promise<RosterPlayerOption[]> {
  const supabase = await createClient();

  const { data: seasonTeams } = await supabase
    .from("season_teams")
    .select("id, display_name, teams(name)")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  if (!seasonTeams?.length) return [];

  const teamNames = new Map<string, string>();
  for (const team of seasonTeams) {
    const rel = team.teams as { name: string } | { name: string }[] | null;
    const teamName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    teamNames.set(
      team.id,
      displaySeasonTeamName(team.display_name, teamName ?? "Equipo")
    );
  }

  const { data: rows } = await supabase
    .from("season_team_players")
    .select("id, season_team_id, registration_status, players(full_name)")
    .eq("organization_id", organizationId)
    .in("season_team_id", seasonTeams.map((t) => t.id))
    .in("registration_status", ["active", "suspended"])
    .order("created_at");

  return (rows ?? []).map((row) => {
    const playerRel = row.players as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    const playerName = Array.isArray(playerRel)
      ? playerRel[0]?.full_name
      : playerRel?.full_name;
    return {
      seasonTeamPlayerId: row.id,
      playerName: playerName ?? "Jugador",
      teamName: teamNames.get(row.season_team_id) ?? "Equipo",
    };
  });
}
