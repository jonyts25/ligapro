import { createClient } from "@/lib/supabase/server";
import type { CaptainLeadershipRole, CaptainTeamLink } from "@/lib/captain/types";

function seasonTeamDisplayName(row: {
  display_name: string | null;
  teams: { name: string } | { name: string }[] | null;
}): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  const rel = row.teams;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return name ?? "Mi equipo";
}

function mapRosterRow(
  row: {
    id: string;
    season_team_id: string;
    organization_id: string;
    season_id: string;
    is_captain: boolean;
    is_vice_captain: boolean;
    season_teams: {
      display_name: string | null;
      teams: { name: string } | { name: string }[] | null;
      seasons:
        | {
            id: string;
            name: string;
            competition_id: string;
            competitions: { name: string } | { name: string }[] | null;
          }
        | {
            id: string;
            name: string;
            competition_id: string;
            competitions: { name: string } | { name: string }[] | null;
          }[]
        | null;
    } | null;
  }
): CaptainTeamLink | null {
  const st = row.season_teams;
  if (!st) return null;
  const seasonRel = st.seasons;
  const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
  if (!season) return null;
  const competitionRel = season.competitions;
  const competition = Array.isArray(competitionRel)
    ? competitionRel[0]
    : competitionRel;

  return {
    seasonTeamPlayerId: row.id,
    seasonTeamId: row.season_team_id,
    organizationId: row.organization_id,
    seasonId: row.season_id,
    teamName: seasonTeamDisplayName(st),
    seasonName: season.name,
    competitionId: season.competition_id,
    competitionName: competition?.name ?? "Torneo",
    leadershipRole: row.is_captain ? "captain" : "vice_captain",
  };
}

async function getCaptainTeamsViaRoster(
  profileId: string
): Promise<CaptainTeamLink[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("season_team_players")
    .select(
      `id, season_team_id, organization_id, season_id, is_captain, is_vice_captain,
       players!inner(profile_id),
       season_teams(display_name, teams(name), seasons(id, name, competition_id, competitions(name)))`
    )
    .eq("players.profile_id", profileId)
    .eq("registration_status", "active")
    .or("is_captain.eq.true,is_vice_captain.eq.true");

  return (data ?? [])
    .map((row) => mapRosterRow(row))
    .filter((row): row is CaptainTeamLink => row !== null);
}

async function getCaptainTeamsViaMatches(
  profileId: string
): Promise<CaptainTeamLink[]> {
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "organization_id, season_id, home_season_team_id, away_season_team_id"
    );

  if (!matches?.length) return [];

  const candidateIds = new Set<string>();
  for (const match of matches) {
    candidateIds.add(match.home_season_team_id);
    candidateIds.add(match.away_season_team_id);
  }

  const leaderTeamIds: string[] = [];
  for (const seasonTeamId of candidateIds) {
    const { data: isLeader } = await supabase.rpc(
      "is_active_captain_or_vice_of_season_team",
      {
        p_season_team_id: seasonTeamId,
        p_profile_id: profileId,
      }
    );
    if (isLeader) leaderTeamIds.push(seasonTeamId);
  }

  if (!leaderTeamIds.length) return [];

  const { data: rosterMeta } = await supabase
    .from("season_team_players")
    .select(
      `id, season_team_id, organization_id, season_id, is_captain, is_vice_captain,
       players!inner(profile_id),
       season_teams(display_name, teams(name), seasons(id, name, competition_id, competitions(name)))`
    )
    .eq("players.profile_id", profileId)
    .in("season_team_id", leaderTeamIds)
    .eq("registration_status", "active")
    .or("is_captain.eq.true,is_vice_captain.eq.true");

  const fromRoster = (rosterMeta ?? [])
    .map((row) => mapRosterRow(row))
    .filter((row): row is CaptainTeamLink => row !== null);

  if (fromRoster.length) return fromRoster;

  const byTeam = new Map<string, CaptainTeamLink>();
  for (const match of matches) {
    for (const seasonTeamId of [
      match.home_season_team_id,
      match.away_season_team_id,
    ]) {
      if (!leaderTeamIds.includes(seasonTeamId) || byTeam.has(seasonTeamId)) {
        continue;
      }
      byTeam.set(seasonTeamId, {
        seasonTeamPlayerId: "",
        seasonTeamId,
        organizationId: match.organization_id,
        seasonId: match.season_id,
        teamName: "Mi equipo",
        seasonName: "Temporada",
        competitionId: "",
        competitionName: "Torneo",
        leadershipRole: "captain" as CaptainLeadershipRole,
      });
    }
  }

  return [...byTeam.values()];
}

export async function getCaptainTeams(
  profileId: string
): Promise<CaptainTeamLink[]> {
  const viaRoster = await getCaptainTeamsViaRoster(profileId);
  if (viaRoster.length) return viaRoster;
  return getCaptainTeamsViaMatches(profileId);
}

export async function hasCaptainTeamAccess(
  profileId: string,
  seasonTeamId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc(
    "is_active_captain_or_vice_of_season_team",
    {
      p_season_team_id: seasonTeamId,
      p_profile_id: profileId,
    }
  );
  return Boolean(data);
}
