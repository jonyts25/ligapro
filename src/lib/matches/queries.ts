import { createClient } from "@/lib/supabase/server";
import type { MatchSchedulingDetails } from "@/lib/fixtures/types";
import { getMatchSchedulingDetails } from "@/lib/fixtures/queries";
import type {
  MatchCapturePermissions,
  MatchDisciplineItem,
  MatchEventType,
  MatchOfficialListItem,
  MatchOfficialRole,
  MatchOfficialStatus,
  MatchRosterPlayer,
  MatchStatusValue,
  MatchTimelineEvent,
  OrgMemberOption,
  SeasonRoleListItem,
  SeasonRoleValue,
} from "@/lib/matches/types";
import { seasonRoleLabel } from "@/lib/matches/types";

function profileLabel(row: {
  display_name: string | null;
  email: string;
}): { displayName: string; email: string } {
  return {
    displayName: row.display_name?.trim() || row.email,
    email: row.email,
  };
}

export async function getOrganizationMemberOptions(
  organizationId: string
): Promise<OrgMemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("profile_id, role, profiles(display_name, email)")
    .eq("organization_id", organizationId);

  return (data ?? []).map((row) => {
    const profileRel = row.profiles as
      | { display_name: string | null; email: string }
      | { display_name: string | null; email: string }[]
      | null;
    const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
    const label = profile
      ? profileLabel(profile)
      : { displayName: "Miembro", email: "" };
    return {
      profileId: row.profile_id,
      displayName: label.displayName,
      email: label.email,
      orgRole: row.role,
    };
  });
}

export async function getSeasonOperationalRoles(
  organizationId: string,
  seasonId: string
): Promise<SeasonRoleListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_roles")
    .select("id, profile_id, role, profiles(display_name, email)")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .order("created_at");

  return (data ?? []).map((row) => {
    const profileRel = row.profiles as
      | { display_name: string | null; email: string }
      | { display_name: string | null; email: string }[]
      | null;
    const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
    const label = profile
      ? profileLabel(profile)
      : { displayName: "Usuario", email: "" };
    return {
      id: row.id,
      profileId: row.profile_id,
      role: row.role as SeasonRoleValue,
      displayName: label.displayName,
      email: label.email,
    };
  });
}

export async function getMatchOfficials(
  organizationId: string,
  matchId: string,
  seasonId: string
): Promise<MatchOfficialListItem[]> {
  const supabase = await createClient();
  const [{ data: officials }, { data: roles }] = await Promise.all([
    supabase
      .from("match_officials")
      .select("id, profile_id, role, status, profiles(display_name, email)")
      .eq("organization_id", organizationId)
      .eq("match_id", matchId)
      .order("created_at"),
    supabase
      .from("season_roles")
      .select("profile_id, role")
      .eq("organization_id", organizationId)
      .eq("season_id", seasonId),
  ]);

  const roleSet = new Set(
    (roles ?? []).map((r) => `${r.profile_id}:${r.role}`)
  );

  return (officials ?? []).map((row) => {
    const profileRel = row.profiles as
      | { display_name: string | null; email: string }
      | { display_name: string | null; email: string }[]
      | null;
    const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
    const label = profile
      ? profileLabel(profile)
      : { displayName: "Usuario", email: "" };
    const role = row.role as MatchOfficialRole;
    const needsSeasonRole = role === "referee" || role === "delegate";
    const hasRequiredSeasonRole = needsSeasonRole
      ? roleSet.has(`${row.profile_id}:${role}`)
      : true;
    return {
      id: row.id,
      profileId: row.profile_id,
      role,
      status: row.status as MatchOfficialStatus,
      displayName: label.displayName,
      email: label.email,
      hasRequiredSeasonRole,
    };
  });
}

export async function getMatchTimeline(
  organizationId: string,
  matchId: string
): Promise<MatchTimelineEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_events")
    .select(
      "id, event_type, minute, notes, created_at, season_team_player_id, season_team_players(season_team_id, registration_status, players(full_name), season_teams(display_name, teams(name)))"
    )
    .eq("organization_id", organizationId)
    .eq("match_id", matchId)
    .order("minute", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => {
    const stpRel = row.season_team_players as
      | {
          season_team_id: string;
          registration_status: string;
          players:
            | { full_name: string }
            | { full_name: string }[]
            | null;
          season_teams:
            | {
                display_name: string | null;
                teams: { name: string } | { name: string }[] | null;
              }
            | {
                display_name: string | null;
                teams: { name: string } | { name: string }[] | null;
              }[]
            | null;
        }
      | null
      | Array<unknown>;

    const stp = Array.isArray(stpRel) ? null : stpRel;
    const playerRel = stp?.players ?? null;
    const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;
    const stRel = stp?.season_teams ?? null;
    const st = Array.isArray(stRel) ? stRel[0] : stRel;
    const teamRel = st?.teams ?? null;
    const team = Array.isArray(teamRel) ? teamRel[0] : teamRel;
    const teamName =
      st?.display_name?.trim() || team?.name || "Equipo";

    return {
      id: row.id,
      eventType: row.event_type as MatchEventType,
      minute: row.minute,
      notes: row.notes,
      createdAt: row.created_at,
      playerName: player?.full_name ?? "Jugador",
      teamName,
      seasonTeamId: stp?.season_team_id ?? "",
      seasonTeamPlayerId: row.season_team_player_id,
    };
  });
}

export async function getMatchDiscipline(
  organizationId: string,
  seasonId: string,
  matchId?: string
): Promise<MatchDisciplineItem[]> {
  const supabase = await createClient();

  const { data: seasonTeams } = await supabase
    .from("season_teams")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  const seasonTeamIds = (seasonTeams ?? []).map((t) => t.id);
  if (!seasonTeamIds.length) return [];

  const { data: stps } = await supabase
    .from("season_team_players")
    .select("id, players(full_name)")
    .eq("organization_id", organizationId)
    .in("season_team_id", seasonTeamIds);

  const stpIds = (stps ?? []).map((s) => s.id);
  if (!stpIds.length) return [];

  const nameById = new Map<string, string>();
  for (const row of stps ?? []) {
    const playerRel = row.players as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;
    nameById.set(row.id, player?.full_name ?? "Jugador");
  }

  const { data } = await supabase
    .from("discipline_suspensions")
    .select(
      "id, suspension_type, status, matches_remaining, matches_served, notes, source_match_event_id, season_team_player_id"
    )
    .eq("organization_id", organizationId)
    .in("season_team_player_id", stpIds)
    .order("created_at", { ascending: false });

  let rows = data ?? [];
  if (matchId) {
    const { data: events } = await supabase
      .from("match_events")
      .select("id")
      .eq("match_id", matchId)
      .eq("organization_id", organizationId);
    const eventIds = new Set((events ?? []).map((e) => e.id));
    rows = rows.filter(
      (r) =>
        r.source_match_event_id != null &&
        eventIds.has(r.source_match_event_id)
    );
  }

  return rows.map((r) => ({
    id: r.id,
    suspensionType: r.suspension_type,
    status: r.status,
    matchesRemaining: r.matches_remaining,
    matchesServed: r.matches_served,
    playerName: nameById.get(r.season_team_player_id) ?? "Jugador",
    notes: r.notes,
    sourceMatchEventId: r.source_match_event_id,
  }));
}

export async function getMatchRosterPlayers(
  organizationId: string,
  homeSeasonTeamId: string,
  awaySeasonTeamId: string
): Promise<MatchRosterPlayer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_team_players")
    .select(
      "id, season_team_id, jersey_number, registration_status, players(full_name)"
    )
    .eq("organization_id", organizationId)
    .in("season_team_id", [homeSeasonTeamId, awaySeasonTeamId])
    .order("jersey_number", { ascending: true });

  return (data ?? []).map((row) => {
    const playerRel = row.players as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;
    return {
      seasonTeamPlayerId: row.id,
      seasonTeamId: row.season_team_id,
      playerName: player?.full_name ?? "Jugador",
      jerseyNumber: row.jersey_number,
      registrationStatus: row.registration_status,
    };
  });
}

export async function getUserMatchCapturePermissions(
  organizationId: string,
  seasonId: string,
  matchId: string,
  userId: string,
  orgRole: string
): Promise<MatchCapturePermissions> {
  const supabase = await createClient();
  const isOrgAdmin =
    orgRole === "organization_owner" || orgRole === "organization_admin";

  const { data: canCapture } = await supabase.rpc("can_capture_match", {
    p_match_id: matchId,
  });

  const { data: seasonRoles } = await supabase
    .from("season_roles")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("profile_id", userId);

  const roles = (seasonRoles ?? []).map((r) => r.role);
  const isTournamentAdmin = roles.includes("tournament_admin");
  const canUpdateResult = isOrgAdmin || isTournamentAdmin;

  const actorBits: string[] = [];
  if (orgRole === "organization_owner") actorBits.push("Owner");
  else if (orgRole === "organization_admin") actorBits.push("Admin");
  else actorBits.push("Miembro");
  for (const role of roles) {
    actorBits.push(seasonRoleLabel(role));
  }

  return {
    canCaptureEvents: Boolean(canCapture),
    canUpdateResult,
    canManageOfficials: isOrgAdmin,
    canManageSeasonRoles: isOrgAdmin,
    actorLabel: actorBits.join(" · "),
  };
}

export async function getMatchCaptureContext(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string,
  userId: string,
  orgRole: string
): Promise<{
  details: MatchSchedulingDetails;
  permissions: MatchCapturePermissions;
  timeline: MatchTimelineEvent[];
  discipline: MatchDisciplineItem[];
  officials: MatchOfficialListItem[];
  roster: MatchRosterPlayer[];
  scoreMismatch: boolean;
} | null> {
  const details = await getMatchSchedulingDetails(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );
  if (!details) return null;

  const [permissions, timeline, discipline, officials, roster] =
    await Promise.all([
      getUserMatchCapturePermissions(
        organizationId,
        seasonId,
        matchId,
        userId,
        orgRole
      ),
      getMatchTimeline(organizationId, matchId),
      getMatchDiscipline(organizationId, seasonId, matchId),
      getMatchOfficials(organizationId, matchId, seasonId),
      getMatchRosterPlayers(
        organizationId,
        details.match.homeSeasonTeamId,
        details.match.awaySeasonTeamId
      ),
    ]);

  const { goalsFromEvents } = await import("@/lib/matches/types");
  const fromEvents = goalsFromEvents(
    timeline,
    details.match.homeSeasonTeamId,
    details.match.awaySeasonTeamId
  );
  const scoreMismatch =
    details.match.homeScore != null &&
    details.match.awayScore != null &&
    (fromEvents.home !== details.match.homeScore ||
      fromEvents.away !== details.match.awayScore);

  return {
    details,
    permissions,
    timeline,
    discipline,
    officials,
    roster,
    scoreMismatch,
  };
}

export async function getRecentMatchResults(
  organizationId: string,
  limit = 5
): Promise<
  Array<{
    id: string;
    seasonId: string;
    competitionId: string;
    homeName: string;
    awayName: string;
    homeScore: number | null;
    awayScore: number | null;
    status: MatchStatusValue;
    updatedAt: string;
  }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(
      "id, season_id, home_season_team_id, away_season_team_id, home_score, away_score, status, updated_at, seasons(competition_id)"
    )
    .eq("organization_id", organizationId)
    .in("status", ["finished", "walkover"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!data?.length) return [];

  const seasonIds = [...new Set(data.map((m) => m.season_id))];
  const nameMaps = new Map<string, Map<string, string>>();

  await Promise.all(
    seasonIds.map(async (seasonId) => {
      const { data: teams } = await supabase
        .from("season_teams")
        .select("id, display_name, teams(name)")
        .eq("organization_id", organizationId)
        .eq("season_id", seasonId);
      const map = new Map<string, string>();
      for (const t of teams ?? []) {
        const rel = t.teams as
          | { name: string }
          | { name: string }[]
          | null;
        const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
        map.set(t.id, t.display_name?.trim() || name || "Equipo");
      }
      nameMaps.set(seasonId, map);
    })
  );

  return data.map((m) => {
    const seasonRel = m.seasons as
      | { competition_id: string }
      | { competition_id: string }[]
      | null;
    const competitionId = Array.isArray(seasonRel)
      ? seasonRel[0]?.competition_id
      : seasonRel?.competition_id;
    const names = nameMaps.get(m.season_id);
    return {
      id: m.id,
      seasonId: m.season_id,
      competitionId: competitionId ?? "",
      homeName: names?.get(m.home_season_team_id) ?? "Local",
      awayName: names?.get(m.away_season_team_id) ?? "Visitante",
      homeScore: m.home_score,
      awayScore: m.away_score,
      status: m.status as MatchStatusValue,
      updatedAt: m.updated_at,
    };
  });
}
