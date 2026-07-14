import { createClient } from "@/lib/supabase/server";
import type {
  AvailablePlayerOption,
  PlayerRecord,
  RosterListItem,
  SeasonRosterStats,
  SeasonTeamDetail,
  SeasonTeamListItem,
  SeasonTeamRegistrationStatus,
  TeamDetail,
  TeamListItem,
  TeamRecord,
  RosterRegistrationStatus,
} from "@/lib/teams/types";

export async function getOrganizationTeams(
  organizationId: string
): Promise<TeamListItem[]> {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, organization_id, name")
    .eq("organization_id", organizationId)
    .order("name");

  if (!teams?.length) return [];

  const teamIds = teams.map((t) => t.id);
  const { data: enrollments } = await supabase
    .from("season_teams")
    .select(
      "team_id, created_at, seasons(name, created_at)"
    )
    .eq("organization_id", organizationId)
    .in("team_id", teamIds)
    .order("created_at", { ascending: false });

  const byTeam = new Map<
    string,
    { count: number; latestSeasonName: string | null }
  >();

  for (const row of enrollments ?? []) {
    const current = byTeam.get(row.team_id) ?? {
      count: 0,
      latestSeasonName: null,
    };
    current.count += 1;
    if (!current.latestSeasonName) {
      const seasonRel = row.seasons as
        | { name: string }
        | { name: string }[]
        | null;
      const seasonName = Array.isArray(seasonRel)
        ? seasonRel[0]?.name
        : seasonRel?.name;
      current.latestSeasonName = seasonName ?? null;
    }
    byTeam.set(row.team_id, current);
  }

  return teams.map((team) => {
    const meta = byTeam.get(team.id);
    return {
      ...(team as TeamRecord),
      seasonEnrollmentCount: meta?.count ?? 0,
      latestSeasonName: meta?.latestSeasonName ?? null,
    };
  });
}

export async function getTeamDetails(
  organizationId: string,
  teamId: string
): Promise<TeamDetail | null> {
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, organization_id, name")
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!team) return null;

  const { data: enrollments } = await supabase
    .from("season_teams")
    .select(
      "id, season_id, registration_status, seasons(id, name, competition_id, competitions(id, name))"
    )
    .eq("team_id", teamId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return {
    ...(team as TeamRecord),
    enrollments: (enrollments ?? []).map((row) => {
      const seasonRel = row.seasons as
        | {
            id: string;
            name: string;
            competition_id: string;
            competitions:
              | { id: string; name: string }
              | { id: string; name: string }[]
              | null;
          }
        | {
            id: string;
            name: string;
            competition_id: string;
            competitions:
              | { id: string; name: string }
              | { id: string; name: string }[]
              | null;
          }[]
        | null;
      const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
      const competitionRel = season?.competitions;
      const competition = Array.isArray(competitionRel)
        ? competitionRel[0]
        : competitionRel;

      return {
        seasonTeamId: row.id,
        seasonId: row.season_id,
        competitionId: season?.competition_id ?? competition?.id ?? "",
        seasonName: season?.name ?? "Temporada",
        competitionName: competition?.name ?? "Torneo",
        registration_status:
          row.registration_status as SeasonTeamRegistrationStatus,
      };
    }),
  };
}

export async function getSeasonTeams(
  organizationId: string,
  seasonId: string
): Promise<SeasonTeamListItem[]> {
  const supabase = await createClient();

  const { data: seasonTeams } = await supabase
    .from("season_teams")
    .select(
      "id, season_id, team_id, organization_id, display_name, group_name, registration_status, teams(name)"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .order("created_at");

  if (!seasonTeams?.length) return [];

  const seasonTeamIds = seasonTeams.map((st) => st.id);
  const { data: roster } = await supabase
    .from("season_team_players")
    .select("season_team_id, is_captain, registration_status, players(full_name)")
    .eq("organization_id", organizationId)
    .in("season_team_id", seasonTeamIds);

  const meta = new Map<
    string,
    { playerCount: number; captainName: string | null }
  >();

  for (const row of roster ?? []) {
    const current = meta.get(row.season_team_id) ?? {
      playerCount: 0,
      captainName: null,
    };
    if (row.registration_status === "active") {
      current.playerCount += 1;
    }
    if (row.is_captain) {
      const playerRel = row.players as
        | { full_name: string }
        | { full_name: string }[]
        | null;
      current.captainName = Array.isArray(playerRel)
        ? playerRel[0]?.full_name ?? null
        : playerRel?.full_name ?? null;
    }
    meta.set(row.season_team_id, current);
  }

  return seasonTeams.map((st) => {
    const teamRel = st.teams as
      | { name: string }
      | { name: string }[]
      | null;
    const teamName = Array.isArray(teamRel)
      ? teamRel[0]?.name
      : teamRel?.name;
    const m = meta.get(st.id);
    return {
      id: st.id,
      season_id: st.season_id,
      team_id: st.team_id,
      organization_id: st.organization_id,
      display_name: st.display_name,
      group_name: st.group_name,
      registration_status:
        st.registration_status as SeasonTeamRegistrationStatus,
      teamName: teamName ?? "Equipo",
      playerCount: m?.playerCount ?? 0,
      captainName: m?.captainName ?? null,
    };
  });
}

export async function getAvailableTeamsForSeason(
  organizationId: string,
  seasonId: string
): Promise<TeamRecord[]> {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, organization_id, name")
    .eq("organization_id", organizationId)
    .order("name");

  const { data: enrolled } = await supabase
    .from("season_teams")
    .select("team_id")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  const enrolledIds = new Set((enrolled ?? []).map((e) => e.team_id));
  return (teams ?? [])
    .filter((t) => !enrolledIds.has(t.id))
    .map((t) => t as TeamRecord);
}

export async function getSeasonTeamRoster(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  seasonTeamId: string
): Promise<SeasonTeamDetail | null> {
  const supabase = await createClient();

  const { data: seasonTeam } = await supabase
    .from("season_teams")
    .select(
      "id, season_id, team_id, organization_id, display_name, group_name, registration_status, teams(name), seasons(id, name, competition_id, competitions(id, name))"
    )
    .eq("id", seasonTeamId)
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!seasonTeam) return null;

  const seasonRel = seasonTeam.seasons as
    | {
        id: string;
        name: string;
        competition_id: string;
        competitions:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
      }
    | {
        id: string;
        name: string;
        competition_id: string;
        competitions:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
      }[]
    | null;
  const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
  if (!season || season.competition_id !== competitionId) return null;

  const competitionRel = season.competitions;
  const competition = Array.isArray(competitionRel)
    ? competitionRel[0]
    : competitionRel;

  const teamRel = seasonTeam.teams as
    | { name: string }
    | { name: string }[]
    | null;
  const teamName = Array.isArray(teamRel)
    ? teamRel[0]?.name
    : teamRel?.name;

  const { data: rosterRows } = await supabase
    .from("season_team_players")
    .select(
      "id, season_team_id, player_id, organization_id, season_id, jersey_number, is_captain, registration_status, players(full_name)"
    )
    .eq("season_team_id", seasonTeamId)
    .eq("organization_id", organizationId)
    .order("jersey_number", { ascending: true, nullsFirst: false });

  const roster: RosterListItem[] = (rosterRows ?? []).map((row) => {
    const playerRel = row.players as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    const fullName = Array.isArray(playerRel)
      ? playerRel[0]?.full_name
      : playerRel?.full_name;
    return {
      id: row.id,
      season_team_id: row.season_team_id,
      player_id: row.player_id,
      organization_id: row.organization_id,
      season_id: row.season_id,
      jersey_number: row.jersey_number,
      is_captain: row.is_captain,
      registration_status: row.registration_status as RosterRegistrationStatus,
      full_name: fullName ?? "Jugador",
    };
  });

  const active = roster.filter((r) => r.registration_status === "active");
  const captain = roster.find((r) => r.is_captain);

  return {
    id: seasonTeam.id,
    season_id: seasonTeam.season_id,
    team_id: seasonTeam.team_id,
    organization_id: seasonTeam.organization_id,
    display_name: seasonTeam.display_name,
    group_name: seasonTeam.group_name,
    registration_status:
      seasonTeam.registration_status as SeasonTeamRegistrationStatus,
    teamName: teamName ?? "Equipo",
    seasonName: season.name,
    competitionId: season.competition_id,
    competitionName: competition?.name ?? "Torneo",
    roster,
    activePlayerCount: active.length,
    captainName: captain?.full_name ?? null,
  };
}

export async function getAvailablePlayersForRoster(
  organizationId: string,
  seasonTeamId: string
): Promise<AvailablePlayerOption[]> {
  const supabase = await createClient();

  const { data: seasonTeam } = await supabase
    .from("season_teams")
    .select("id, season_id")
    .eq("id", seasonTeamId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!seasonTeam) return [];

  const { data: players } = await supabase
    .from("players")
    .select("id, organization_id, full_name, profile_id")
    .eq("organization_id", organizationId)
    .order("full_name");

  const { data: thisRoster } = await supabase
    .from("season_team_players")
    .select("player_id, registration_status")
    .eq("season_team_id", seasonTeamId)
    .eq("organization_id", organizationId);

  const occupyingHere = new Set(
    (thisRoster ?? [])
      .filter(
        (r) =>
          r.registration_status === "active" ||
          r.registration_status === "suspended"
      )
      .map((r) => r.player_id)
  );

  const { data: seasonOccupied } = await supabase
    .from("season_team_players")
    .select(
      "player_id, season_team_id, registration_status, season_teams(id, display_name, teams(name))"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonTeam.season_id)
    .in("registration_status", ["active", "suspended"]);

  const blockedBy = new Map<string, string>();
  for (const row of seasonOccupied ?? []) {
    if (row.season_team_id === seasonTeamId) continue;
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
    const st = Array.isArray(stRel) ? stRel[0] : stRel;
    const teamRel = st?.teams;
    const teamName = Array.isArray(teamRel)
      ? teamRel[0]?.name
      : teamRel?.name;
    const display = st?.display_name?.trim();
    blockedBy.set(
      row.player_id,
      display || teamName || "otro equipo de la temporada"
    );
  }

  return (players ?? [])
    .filter((p) => !occupyingHere.has(p.id))
    .map((p) => {
      const occupiedByTeamName = blockedBy.get(p.id) ?? null;
      return {
        ...(p as PlayerRecord),
        selectable: occupiedByTeamName == null,
        occupiedByTeamName,
      };
    });
}

export async function getSeasonRosterStats(
  organizationId: string,
  seasonId: string
): Promise<SeasonRosterStats> {
  const supabase = await createClient();

  const { data: seasonTeams } = await supabase
    .from("season_teams")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  const teamCount = seasonTeams?.length ?? 0;
  if (teamCount === 0) {
    return { teamCount: 0, activePlayerCount: 0, teamsWithCaptain: 0 };
  }

  const ids = seasonTeams!.map((st) => st.id);
  const { data: roster } = await supabase
    .from("season_team_players")
    .select("season_team_id, is_captain, registration_status")
    .eq("organization_id", organizationId)
    .in("season_team_id", ids);

  let activePlayerCount = 0;
  const captains = new Set<string>();
  for (const row of roster ?? []) {
    if (row.registration_status === "active") activePlayerCount += 1;
    if (row.is_captain) captains.add(row.season_team_id);
  }

  return {
    teamCount,
    activePlayerCount,
    teamsWithCaptain: captains.size,
  };
}

export async function getOrganizationTeamStats(
  organizationId: string
): Promise<{ teams: number; seasonEnrollments: number }> {
  const supabase = await createClient();

  const { count: teams } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const { count: seasonEnrollments } = await supabase
    .from("season_teams")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return {
    teams: teams ?? 0,
    seasonEnrollments: seasonEnrollments ?? 0,
  };
}
