import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database";

import {
  fetchMyOfficialMatchAssignments,
  type MyOfficialMatchAssignmentCore,
  type SharedSupabaseClient,
} from "./my-official-match-assignments";

export type PersonAdminOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type PersonPlayerTeam = {
  playerId: string;
  seasonTeamPlayerId: string;
  seasonTeamId: string;
  teamName: string;
  seasonName: string;
  seasonSlug: string;
  competitionName: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type PersonContexts = {
  organizacionesAdmin: PersonAdminOrganization[];
  partidosPorArbitrar: MyOfficialMatchAssignmentCore[];
  equiposComoJugador: PersonPlayerTeam[];
};

type AdminMemberRow = {
  role: string;
  organizations:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
};

type PlayerTeamRow = {
  id: string;
  season_team_id: string;
  player_id: string;
  is_captain: boolean;
  is_vice_captain: boolean;
  season_teams: {
    display_name: string | null;
    organization_id: string;
    teams: { name: string } | { name: string }[] | null;
    organizations:
      | { name: string; slug: string }
      | { name: string; slug: string }[]
      | null;
    seasons:
      | {
          name: string;
          slug: string;
          competitions: { name: string } | { name: string }[] | null;
        }
      | {
          name: string;
          slug: string;
          competitions: { name: string } | { name: string }[] | null;
        }[]
      | null;
  } | null;
};

function seasonTeamDisplayName(row: {
  display_name: string | null;
  teams: { name: string } | { name: string }[] | null;
}): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  const rel = row.teams;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return name ?? "Mi equipo";
}

export function mapAdminOrganizationRows(
  rows: AdminMemberRow[]
): PersonAdminOrganization[] {
  const byId = new Map<string, PersonAdminOrganization>();

  for (const row of rows) {
    const orgRel = row.organizations;
    const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;
    if (!org) continue;
    byId.set(org.id, {
      id: org.id,
      name: org.name,
      slug: org.slug,
    });
  }

  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );
}

export function mapPlayerTeamRows(rows: PlayerTeamRow[]): PersonPlayerTeam[] {
  const mapped: PersonPlayerTeam[] = [];

  for (const row of rows) {
    const st = row.season_teams;
    if (!st) continue;

    const orgRel = st.organizations;
    const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;
    const seasonRel = st.seasons;
    const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
    if (!org || !season) continue;

    const competitionRel = season.competitions;
    const competition = Array.isArray(competitionRel)
      ? competitionRel[0]
      : competitionRel;

    mapped.push({
      playerId: row.player_id,
      seasonTeamPlayerId: row.id,
      seasonTeamId: row.season_team_id,
      teamName: seasonTeamDisplayName(st),
      seasonName: season.name,
      seasonSlug: season.slug,
      competitionName: competition?.name ?? "Torneo",
      organizationId: st.organization_id,
      organizationName: org.name,
      organizationSlug: org.slug,
      isCaptain: row.is_captain,
      isViceCaptain: row.is_vice_captain,
    });
  }

  return mapped.sort((a, b) =>
    `${a.organizationName} ${a.teamName}`.localeCompare(
      `${b.organizationName} ${b.teamName}`,
      "es"
    )
  );
}

async function fetchAdminOrganizations(
  client: SupabaseClient<Database>,
  profileId: string
): Promise<PersonAdminOrganization[]> {
  const { data, error } = await client
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("profile_id", profileId)
    .in("role", ["organization_owner", "organization_admin"]);

  if (error) {
    throw new Error(error.message);
  }

  return mapAdminOrganizationRows((data ?? []) as AdminMemberRow[]);
}

async function fetchPlayerTeams(
  client: SupabaseClient<Database>,
  profileId: string
): Promise<PersonPlayerTeam[]> {
  const { data: ownPlayers, error: playersError } = await client
    .from("players")
    .select("id")
    .eq("profile_id", profileId);

  if (playersError) {
    throw new Error(playersError.message);
  }

  const playerIds = (ownPlayers ?? []).map((row) => row.id);
  if (!playerIds.length) {
    return [];
  }

  const { data, error } = await client
    .from("season_team_players")
    .select(
      `id, season_team_id, player_id, is_captain, is_vice_captain,
       season_teams(display_name, organization_id, teams(name), organizations(name, slug),
         seasons(name, slug, competitions(name)))`
    )
    .in("player_id", playerIds)
    .eq("registration_status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return mapPlayerTeamRows((data ?? []) as PlayerTeamRow[]);
}

export async function getPersonContexts(
  supabase: SharedSupabaseClient,
  profileId: string
): Promise<PersonContexts> {
  const client = supabase as SupabaseClient<Database>;

  const [organizacionesAdmin, partidosPorArbitrar, equiposComoJugador] =
    await Promise.all([
      fetchAdminOrganizations(client, profileId),
      fetchMyOfficialMatchAssignments(supabase, profileId),
      fetchPlayerTeams(client, profileId),
    ]);

  return {
    organizacionesAdmin,
    partidosPorArbitrar,
    equiposComoJugador,
  };
}
