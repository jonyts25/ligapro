import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database";

/** Accepts any SupabaseClient instance (web/mobile may resolve different package copies). */
export type SharedSupabaseClient = unknown;

export type MatchParticipationStatus =
  | "called"
  | "confirmed"
  | "declined"
  | "played"
  | "no_show";

export type MatchRosterEligibility = {
  isSuspended: boolean;
  matchesRemaining: number;
  suspensionType: string | null;
};

export type MatchRosterCapturePlayer = {
  seasonTeamPlayerId: string;
  seasonTeamId: string;
  fullName: string;
  jerseyNumber: number | null;
  participationStatus: MatchParticipationStatus | null;
  isSuspended: boolean;
  matchesRemaining: number;
  suspensionType: string | null;
};

export type MatchRosterForCapture = {
  matchId: string;
  organizationId: string;
  seasonId: string;
  matchStatus: string;
  halfDurationMinutes: number;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogoUrl: string | null;
  awayTeamLogoUrl: string | null;
  homePlayers: MatchRosterCapturePlayer[];
  awayPlayers: MatchRosterCapturePlayer[];
};

const DEFAULT_ELIGIBILITY: MatchRosterEligibility = {
  isSuspended: false,
  matchesRemaining: 0,
  suspensionType: null,
};

export function formatRosterSuspensionAlert(input: {
  isSuspended: boolean;
  matchesRemaining: number;
}): string | null {
  if (!input.isSuspended) return null;
  const count = Math.max(0, input.matchesRemaining);
  const label = count === 1 ? "partido" : "partidos";
  return `Suspendido — ${count} ${label}`;
}

export function mapMatchRosterEligibilityRows(
  rows: Array<{
    season_team_player_id: string;
    is_suspended: boolean;
    matches_remaining: number;
    suspension_type: string | null;
  }> | null
): Map<string, MatchRosterEligibility> {
  const map = new Map<string, MatchRosterEligibility>();
  for (const row of rows ?? []) {
    map.set(row.season_team_player_id, {
      isSuspended: row.is_suspended,
      matchesRemaining: row.matches_remaining,
      suspensionType: row.suspension_type,
    });
  }
  return map;
}

export async function fetchMatchRosterEligibilityByPlayer(
  supabase: SharedSupabaseClient,
  matchId: string
): Promise<Map<string, MatchRosterEligibility>> {
  const client = supabase as SupabaseClient<Database>;
  const { data, error } = await client.rpc("get_match_roster_eligibility", {
    p_match_id: matchId,
  });

  if (error) {
    throw error;
  }

  return mapMatchRosterEligibilityRows(data ?? []);
}

function teamDisplayName(row: {
  display_name: string | null;
  teams:
    | { name: string; logo_path: string | null }
    | { name: string; logo_path: string | null }[]
    | null;
}): { name: string; logoPath: string | null } {
  const rel = row.teams;
  const team = Array.isArray(rel) ? rel[0] : rel;
  return {
    name: row.display_name?.trim() || team?.name || "Equipo",
    logoPath: team?.logo_path ?? null,
  };
}

function publicTeamLogoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null;
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    null;
  if (!base) return null;
  return `${base}/storage/v1/object/public/team-logos/${logoPath}`;
}

/** Pure builder — testable without Supabase. */
export function buildMatchRosterForCapture(input: {
  match: {
    id: string;
    organization_id: string;
    season_id: string;
    status: string;
    home_season_team_id: string;
    away_season_team_id: string;
  };
  matchDurationMinutes: number | null;
  seasonTeams: Array<{
    id: string;
    display_name: string | null;
    teams:
      | { name: string; logo_path: string | null }
      | { name: string; logo_path: string | null }[]
      | null;
  }>;
  roster: Array<{
    id: string;
    season_team_id: string;
    jersey_number: number | null;
    players:
      | { full_name: string }
      | { full_name: string }[]
      | null;
  }>;
  participationByPlayer: Map<string, MatchParticipationStatus>;
  eligibilityByPlayer?: Map<string, MatchRosterEligibility>;
}): MatchRosterForCapture {
  const teamMeta = new Map<string, { name: string; logoPath: string | null }>();
  for (const row of input.seasonTeams) {
    teamMeta.set(row.id, teamDisplayName(row));
  }

  const homeMeta = teamMeta.get(input.match.home_season_team_id);
  const awayMeta = teamMeta.get(input.match.away_season_team_id);
  const duration = input.matchDurationMinutes ?? 90;
  const eligibilityByPlayer = input.eligibilityByPlayer ?? new Map();

  const mapPlayer = (
    row: (typeof input.roster)[number]
  ): MatchRosterCapturePlayer => {
    const playerRel = row.players;
    const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;
    const eligibility =
      eligibilityByPlayer.get(row.id) ?? DEFAULT_ELIGIBILITY;
    return {
      seasonTeamPlayerId: row.id,
      seasonTeamId: row.season_team_id,
      fullName: player?.full_name ?? "Jugador",
      jerseyNumber: row.jersey_number,
      participationStatus:
        input.participationByPlayer.get(row.id) ?? null,
      isSuspended: eligibility.isSuspended,
      matchesRemaining: eligibility.matchesRemaining,
      suspensionType: eligibility.suspensionType,
    };
  };

  const players = input.roster.map(mapPlayer);

  return {
    matchId: input.match.id,
    organizationId: input.match.organization_id,
    seasonId: input.match.season_id,
    matchStatus: input.match.status,
    halfDurationMinutes: Math.max(1, Math.floor(duration / 2)),
    homeSeasonTeamId: input.match.home_season_team_id,
    awaySeasonTeamId: input.match.away_season_team_id,
    homeTeamName: homeMeta?.name ?? "Local",
    awayTeamName: awayMeta?.name ?? "Visitante",
    homeTeamLogoUrl: publicTeamLogoUrl(homeMeta?.logoPath ?? null),
    awayTeamLogoUrl: publicTeamLogoUrl(awayMeta?.logoPath ?? null),
    homePlayers: players.filter(
      (p) => p.seasonTeamId === input.match.home_season_team_id
    ),
    awayPlayers: players.filter(
      (p) => p.seasonTeamId === input.match.away_season_team_id
    ),
  };
}

export async function fetchMatchRosterForCapture(
  supabase: SharedSupabaseClient,
  matchId: string
): Promise<MatchRosterForCapture | null> {
  const client = supabase as SupabaseClient<Database>;

  const { data: match } = await client
    .from("matches")
    .select(
      "id, organization_id, season_id, status, home_season_team_id, away_season_team_id"
    )
    .eq("id", matchId)
    .maybeSingle();

  if (!match) return null;

  const [
    { data: rules },
    { data: seasonTeams },
    { data: roster },
    { data: participants },
    eligibilityByPlayer,
  ] = await Promise.all([
    client
      .from("season_rules")
      .select("match_duration_minutes")
      .eq("season_id", match.season_id)
      .eq("organization_id", match.organization_id)
      .maybeSingle(),
    client
      .from("season_teams")
      .select("id, display_name, teams(name, logo_path)")
      .eq("organization_id", match.organization_id)
      .in("id", [match.home_season_team_id, match.away_season_team_id]),
    client
      .from("season_team_players")
      .select("id, season_team_id, jersey_number, players(full_name)")
      .eq("organization_id", match.organization_id)
      .in("season_team_id", [
        match.home_season_team_id,
        match.away_season_team_id,
      ])
      .neq("registration_status", "inactive")
      .order("jersey_number", { ascending: true, nullsFirst: false }),
    client
      .from("match_participants")
      .select("season_team_player_id, status")
      .eq("match_id", matchId),
    fetchMatchRosterEligibilityByPlayer(client, matchId),
  ]);

  const participationByPlayer = new Map<string, MatchParticipationStatus>();
  for (const row of participants ?? []) {
    participationByPlayer.set(
      row.season_team_player_id,
      row.status as MatchParticipationStatus
    );
  }

  return buildMatchRosterForCapture({
    match,
    matchDurationMinutes: rules?.match_duration_minutes ?? null,
    seasonTeams: seasonTeams ?? [],
    roster: roster ?? [],
    participationByPlayer,
    eligibilityByPlayer,
  });
}
