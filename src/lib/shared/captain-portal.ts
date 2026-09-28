import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database";

import type { SharedSupabaseClient } from "./my-official-match-assignments";

export type CaptainRosterPlayerCore = {
  id: string;
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  registrationStatus: string;
  photoPath: string | null;
  verificationStatus: string;
  profileId: string | null;
};

export type CaptainMatchCore = {
  id: string;
  seasonId: string;
  organizationId: string;
  roundNumber: number | null;
  legNumber: number | null;
  calendarStatus: "programado" | "confirmado";
  status: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeName: string;
  awayName: string;
  isOwnHome: boolean;
  opponentName: string;
  startsAt: string | null;
  venueName: string | null;
  fieldName: string | null;
  isProgrammed: boolean;
  homeScore: number | null;
  awayScore: number | null;
};

type SeasonTeamNameRow = {
  id: string;
  display_name: string | null;
  teams: { name: string } | { name: string }[] | null;
};

type ReservationRow = {
  id: string;
  starts_at: string;
  fields:
    | {
        name: string;
        venues: { name: string } | { name: string }[] | null;
      }
    | {
        name: string;
        venues: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

type MatchRow = {
  id: string;
  season_id: string;
  organization_id: string;
  home_season_team_id: string;
  away_season_team_id: string;
  round_number: number | null;
  leg_number: number | null;
  calendar_status: string | null;
  field_reservation_id: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

function seasonTeamDisplayName(row: SeasonTeamNameRow): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  const rel = row.teams;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return name ?? "Equipo";
}

export function mapSeasonTeamNameRows(
  rows: SeasonTeamNameRow[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.id, seasonTeamDisplayName(row));
  }
  return map;
}

export function mapReservationRows(
  rows: ReservationRow[]
): Map<string, { startsAt: string; venueName: string | null; fieldName: string | null }> {
  const map = new Map<
    string,
    { startsAt: string; venueName: string | null; fieldName: string | null }
  >();

  for (const row of rows) {
    const fieldRel = row.fields;
    const field = Array.isArray(fieldRel) ? fieldRel[0] : fieldRel;
    const venueRel = field?.venues ?? null;
    const venue = Array.isArray(venueRel) ? venueRel[0] : venueRel;
    map.set(row.id, {
      startsAt: row.starts_at,
      venueName: venue?.name ?? null,
      fieldName: field?.name ?? null,
    });
  }

  return map;
}

function opponentNameForMatch(
  match: Pick<MatchRow, "home_season_team_id" | "away_season_team_id">,
  ownTeamId: string,
  names: Map<string, string>
): { opponentName: string; isOwnHome: boolean } {
  const isOwnHome = match.home_season_team_id === ownTeamId;
  const opponentId = isOwnHome
    ? match.away_season_team_id
    : match.home_season_team_id;
  return {
    opponentName: names.get(opponentId) ?? "Rival",
    isOwnHome,
  };
}

export function mapCaptainMatchRows(
  matches: MatchRow[],
  ownSeasonTeamId: string,
  names: Map<string, string>,
  reservations: Map<
    string,
    { startsAt: string; venueName: string | null; fieldName: string | null }
  >,
  options?: { limit?: number; upcomingOnly?: boolean }
): CaptainMatchCore[] {
  const now = Date.now();
  const limit = options?.limit ?? 20;
  const upcomingOnly = options?.upcomingOnly ?? true;

  const mapped = matches.map((match) => {
    const reservation = match.field_reservation_id
      ? reservations.get(match.field_reservation_id)
      : undefined;
    const { opponentName, isOwnHome } = opponentNameForMatch(
      match,
      ownSeasonTeamId,
      names
    );

    return {
      id: match.id,
      seasonId: match.season_id,
      organizationId: match.organization_id,
      roundNumber: match.round_number,
      legNumber: match.leg_number,
      calendarStatus:
        match.calendar_status === "confirmado" ? "confirmado" : "programado",
      status: match.status,
      homeSeasonTeamId: match.home_season_team_id,
      awaySeasonTeamId: match.away_season_team_id,
      homeName: names.get(match.home_season_team_id) ?? "Local",
      awayName: names.get(match.away_season_team_id) ?? "Visitante",
      isOwnHome,
      opponentName,
      startsAt: reservation?.startsAt ?? null,
      venueName: reservation?.venueName ?? null,
      fieldName: reservation?.fieldName ?? null,
      isProgrammed: Boolean(match.field_reservation_id && reservation),
      homeScore: match.home_score,
      awayScore: match.away_score,
    } satisfies CaptainMatchCore;
  });

  const filtered = upcomingOnly
    ? mapped.filter((match) => {
        if (!match.startsAt) return match.status === "scheduled";
        const time = new Date(match.startsAt).getTime();
        return !Number.isNaN(time) && time >= now;
      })
    : mapped;

  return filtered.slice(0, limit);
}

export function formatCaptainMatchScore(match: CaptainMatchCore): string | null {
  if (match.homeScore == null || match.awayScore == null) {
    return null;
  }
  if (match.isOwnHome) {
    return `${match.homeScore} - ${match.awayScore}`;
  }
  return `${match.awayScore} - ${match.homeScore}`;
}

export function registrationStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Activo";
    case "inactive":
      return "Inactivo";
    case "suspended":
      return "Suspendido";
    default:
      return status;
  }
}

export async function fetchCaptainRosterCore(
  supabase: SharedSupabaseClient,
  seasonTeamId: string,
  seasonId: string
): Promise<{
  roster: CaptainRosterPlayerCore[];
  requirePlayerVerification: boolean;
  rosterLockedByCaptain: boolean;
}> {
  const client = supabase as SupabaseClient<Database>;

  const [{ data: rosterRows }, { data: rules }, { data: seasonTeam }] =
    await Promise.all([
      client
        .from("season_team_players")
        .select(
          "id, player_id, jersey_number, is_captain, is_vice_captain, registration_status, players(full_name, photo_path, verification_status, profile_id)"
        )
        .eq("season_team_id", seasonTeamId)
        .order("jersey_number", { ascending: true, nullsFirst: false }),
      client
        .from("season_rules")
        .select("require_player_verification")
        .eq("season_id", seasonId)
        .maybeSingle(),
      client
        .from("season_teams")
        .select("roster_locked_by_captain, season_id")
        .eq("id", seasonTeamId)
        .maybeSingle(),
    ]);

  const roster = (rosterRows ?? []).map((row) => {
    const playerRel = row.players as
      | {
          full_name: string;
          photo_path: string | null;
          verification_status: string;
          profile_id: string | null;
        }
      | {
          full_name: string;
          photo_path: string | null;
          verification_status: string;
          profile_id: string | null;
        }[]
      | null;
    const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;

    return {
      id: row.id,
      playerId: row.player_id,
      fullName: player?.full_name ?? "Jugador",
      jerseyNumber: row.jersey_number,
      isCaptain: row.is_captain,
      isViceCaptain: row.is_vice_captain,
      registrationStatus: row.registration_status,
      photoPath: player?.photo_path ?? null,
      verificationStatus: player?.verification_status ?? "not_required",
      profileId: player?.profile_id ?? null,
    };
  });

  return {
    roster,
    requirePlayerVerification: rules?.require_player_verification ?? false,
    rosterLockedByCaptain: seasonTeam?.roster_locked_by_captain ?? false,
  };
}

export async function fetchCaptainUpcomingMatchesCore(
  supabase: SharedSupabaseClient,
  seasonTeamId: string,
  seasonId: string,
  limit = 20
): Promise<CaptainMatchCore[]> {
  const client = supabase as SupabaseClient<Database>;

  const { data: matches, error } = await client
    .from("matches")
    .select(
      "id, season_id, organization_id, home_season_team_id, away_season_team_id, round_number, leg_number, calendar_status, field_reservation_id, status, home_score, away_score"
    )
    .eq("season_id", seasonId)
    .or(
      `home_season_team_id.eq.${seasonTeamId},away_season_team_id.eq.${seasonTeamId}`
    )
    .order("round_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!matches?.length) {
    return [];
  }

  const teamIds = new Set<string>();
  const reservationIds: string[] = [];
  for (const match of matches) {
    teamIds.add(match.home_season_team_id);
    teamIds.add(match.away_season_team_id);
    if (match.field_reservation_id) {
      reservationIds.push(match.field_reservation_id);
    }
  }

  const [{ data: teamRows }, { data: reservationRows }] = await Promise.all([
    client
      .from("season_teams")
      .select("id, display_name, teams(name)")
      .in("id", [...teamIds]),
    reservationIds.length
      ? client
          .from("field_reservations")
          .select("id, starts_at, fields(name, venues(name))")
          .in("id", reservationIds)
      : Promise.resolve({ data: [] as ReservationRow[], error: null }),
  ]);

  return mapCaptainMatchRows(
    matches as MatchRow[],
    seasonTeamId,
    mapSeasonTeamNameRows((teamRows ?? []) as SeasonTeamNameRow[]),
    mapReservationRows((reservationRows ?? []) as ReservationRow[]),
    { limit, upcomingOnly: true }
  );
}

export async function fetchOpponentCaptainPhoneCore(
  supabase: SharedSupabaseClient,
  match: Pick<
    CaptainMatchCore,
    "isOwnHome" | "homeSeasonTeamId" | "awaySeasonTeamId"
  >
): Promise<string | null> {
  const client = supabase as SupabaseClient<Database>;
  const opponentTeamId = match.isOwnHome
    ? match.awaySeasonTeamId
    : match.homeSeasonTeamId;

  const { data: leaders, error } = await client
    .from("season_team_players")
    .select("is_captain, is_vice_captain, players(profile_id)")
    .eq("season_team_id", opponentTeamId)
    .eq("registration_status", "active")
    .or("is_captain.eq.true,is_vice_captain.eq.true");

  if (error || !leaders?.length) {
    return null;
  }

  const sorted = [...leaders].sort((a, b) => {
    if (a.is_captain && !b.is_captain) return -1;
    if (!a.is_captain && b.is_captain) return 1;
    return 0;
  });

  const profileIds = sorted
    .map((row) => {
      const player = row.players as { profile_id: string | null } | null;
      return player?.profile_id ?? null;
    })
    .filter((id): id is string => Boolean(id));

  if (profileIds.length === 0) {
    return null;
  }

  const { data: profiles } = await client
    .from("profiles")
    .select("id, phone")
    .in("id", profileIds);

  const phoneById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.phone] as const)
  );

  for (const profileId of profileIds) {
    const phone = phoneById.get(profileId)?.trim();
    if (phone) return phone;
  }

  return null;
}

export async function fetchSeasonTeamSeasonId(
  supabase: SharedSupabaseClient,
  seasonTeamId: string
): Promise<string | null> {
  const client = supabase as SupabaseClient<Database>;
  const { data, error } = await client
    .from("season_teams")
    .select("season_id")
    .eq("id", seasonTeamId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.season_id ?? null;
}
