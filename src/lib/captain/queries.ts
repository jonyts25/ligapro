import { createClient } from "@/lib/supabase/server";
import {
  hasCaptainTeamAccess,
} from "@/lib/auth/get-captain-teams";
import type {
  CaptainInvitationPreview,
  CaptainMatchListItem,
  CaptainRescheduleRequest,
  CaptainRosterPlayer,
} from "@/lib/captain/types";
import type { CaptainTeamLink } from "@/lib/captain/types";

function opponentName(
  match: {
    home_season_team_id: string;
    away_season_team_id: string;
  },
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

async function loadSeasonTeamNames(
  seasonTeamIds: string[]
): Promise<Map<string, string>> {
  if (!seasonTeamIds.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_teams")
    .select("id, display_name, teams(name)")
    .in("id", seasonTeamIds);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const teamRel = row.teams as
      | { name: string }
      | { name: string }[]
      | null;
    const teamName = Array.isArray(teamRel)
      ? teamRel[0]?.name
      : teamRel?.name;
    map.set(
      row.id,
      row.display_name?.trim() || teamName || "Equipo"
    );
  }
  return map;
}

async function loadReservations(
  reservationIds: string[]
): Promise<
  Map<
    string,
    {
      startsAt: string;
      venueName: string | null;
      fieldName: string | null;
    }
  >
> {
  if (!reservationIds.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("field_reservations")
    .select("id, starts_at, fields(name, venues(name))")
    .in("id", reservationIds);

  const map = new Map<
    string,
    { startsAt: string; venueName: string | null; fieldName: string | null }
  >();
  for (const row of data ?? []) {
    const fieldRel = row.fields as
      | { name: string; venues: { name: string } | { name: string }[] | null }
      | { name: string; venues: { name: string } | { name: string }[] | null }[]
      | null;
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

export async function getCaptainTeamContext(
  profileId: string,
  seasonTeamId: string
): Promise<CaptainTeamLink | null> {
  const allowed = await hasCaptainTeamAccess(profileId, seasonTeamId);
  if (!allowed) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("season_team_players")
    .select(
      `id, season_team_id, organization_id, season_id, is_captain, is_vice_captain,
       players!inner(profile_id),
       season_teams(display_name, teams(name), seasons(id, name, competition_id, competitions(name)))`
    )
    .eq("players.profile_id", profileId)
    .eq("season_team_id", seasonTeamId)
    .eq("registration_status", "active")
    .or("is_captain.eq.true,is_vice_captain.eq.true")
    .maybeSingle();

  if (!row) {
    const { data: matchSeed } = await supabase
      .from("matches")
      .select("organization_id, season_id")
      .or(
        `home_season_team_id.eq.${seasonTeamId},away_season_team_id.eq.${seasonTeamId}`
      )
      .limit(1)
      .maybeSingle();

    if (!matchSeed) return null;

    return {
      seasonTeamPlayerId: "",
      seasonTeamId,
      organizationId: matchSeed.organization_id,
      seasonId: matchSeed.season_id,
      teamName: "Mi equipo",
      seasonName: "Temporada",
      competitionId: "",
      competitionName: "Torneo",
      leadershipRole: "captain",
    };
  }

  const st = row.season_teams as {
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
  const seasonRel = st?.seasons;
  const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
  const competitionRel = season?.competitions;
  const competition = Array.isArray(competitionRel)
    ? competitionRel[0]
    : competitionRel;

  return {
    seasonTeamPlayerId: row.id,
    seasonTeamId: row.season_team_id,
    organizationId: row.organization_id,
    seasonId: row.season_id,
    teamName: st?.display_name?.trim() || (Array.isArray(st?.teams) ? st?.teams[0]?.name : st?.teams?.name) || "Mi equipo",
    seasonName: season?.name ?? "Temporada",
    competitionId: season?.competition_id ?? "",
    competitionName: competition?.name ?? "Torneo",
    leadershipRole: row.is_captain ? "captain" : "vice_captain",
  };
}

export async function getCaptainUpcomingMatches(
  profileId: string,
  team: CaptainTeamLink,
  limit = 20
): Promise<CaptainMatchListItem[]> {
  const allowed = await hasCaptainTeamAccess(profileId, team.seasonTeamId);
  if (!allowed) return [];

  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, season_id, organization_id, home_season_team_id, away_season_team_id, round_number, leg_number, calendar_status, field_reservation_id, status"
    )
    .eq("season_id", team.seasonId)
    .or(
      `home_season_team_id.eq.${team.seasonTeamId},away_season_team_id.eq.${team.seasonTeamId}`
    )
    .order("round_number", { ascending: true });

  if (!matches?.length) return [];

  const teamIds = new Set<string>();
  const reservationIds: string[] = [];
  for (const m of matches) {
    teamIds.add(m.home_season_team_id);
    teamIds.add(m.away_season_team_id);
    if (m.field_reservation_id) reservationIds.push(m.field_reservation_id);
  }

  const [names, reservations] = await Promise.all([
    loadSeasonTeamNames([...teamIds]),
    loadReservations(reservationIds),
  ]);

  const now = Date.now();
  return matches
    .map((m) => {
      const res = m.field_reservation_id
        ? reservations.get(m.field_reservation_id)
        : undefined;
      const { opponentName: opp, isOwnHome } = opponentName(
        m,
        team.seasonTeamId,
        names
      );
      return {
        id: m.id,
        seasonId: m.season_id,
        organizationId: m.organization_id,
        roundNumber: m.round_number,
        legNumber: m.leg_number,
        calendarStatus:
          m.calendar_status === "confirmado" ? "confirmado" : "programado",
        status: m.status,
        homeSeasonTeamId: m.home_season_team_id,
        awaySeasonTeamId: m.away_season_team_id,
        homeName: names.get(m.home_season_team_id) ?? "Local",
        awayName: names.get(m.away_season_team_id) ?? "Visitante",
        isOwnHome,
        opponentName: opp,
        startsAt: res?.startsAt ?? null,
        venueName: res?.venueName ?? null,
        fieldName: res?.fieldName ?? null,
        isProgrammed: Boolean(m.field_reservation_id && res),
      } satisfies CaptainMatchListItem;
    })
    .filter((m) => {
      if (!m.startsAt) return m.status === "scheduled";
      const t = new Date(m.startsAt).getTime();
      return !Number.isNaN(t) && t >= now;
    })
    .slice(0, limit);
}

export async function getCaptainMatchDetail(
  profileId: string,
  seasonTeamId: string,
  matchId: string
): Promise<{ team: CaptainTeamLink; match: CaptainMatchListItem } | null> {
  const team = await getCaptainTeamContext(profileId, seasonTeamId);
  if (!team) return null;

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("matches")
    .select(
      "id, season_id, organization_id, home_season_team_id, away_season_team_id, round_number, leg_number, calendar_status, field_reservation_id, status"
    )
    .eq("id", matchId)
    .maybeSingle();

  if (!m) return null;
  if (
    m.home_season_team_id !== seasonTeamId &&
    m.away_season_team_id !== seasonTeamId
  ) {
    return null;
  }

  const names = await loadSeasonTeamNames([
    m.home_season_team_id,
    m.away_season_team_id,
  ]);
  const reservations = m.field_reservation_id
    ? await loadReservations([m.field_reservation_id])
    : new Map();
  const res = m.field_reservation_id
    ? reservations.get(m.field_reservation_id)
    : undefined;
  const { opponentName: opp, isOwnHome } = opponentName(
    m,
    seasonTeamId,
    names
  );

  return {
    team,
    match: {
      id: m.id,
      seasonId: m.season_id,
      organizationId: m.organization_id,
      roundNumber: m.round_number,
      legNumber: m.leg_number,
      calendarStatus:
        m.calendar_status === "confirmado" ? "confirmado" : "programado",
      status: m.status,
      homeSeasonTeamId: m.home_season_team_id,
      awaySeasonTeamId: m.away_season_team_id,
      homeName: names.get(m.home_season_team_id) ?? "Local",
      awayName: names.get(m.away_season_team_id) ?? "Visitante",
      isOwnHome,
      opponentName: opp,
      startsAt: res?.startsAt ?? null,
      venueName: res?.venueName ?? null,
      fieldName: res?.fieldName ?? null,
      isProgrammed: Boolean(m.field_reservation_id && res),
    },
  };
}

export async function getCaptainRoster(
  profileId: string,
  team: CaptainTeamLink
): Promise<CaptainRosterPlayer[]> {
  const allowed = await hasCaptainTeamAccess(profileId, team.seasonTeamId);
  if (!allowed) return [];

  const supabase = await createClient();
  const { data: rosterRows } = await supabase
    .from("season_team_players")
    .select(
      "id, jersey_number, is_captain, is_vice_captain, registration_status, players(full_name)"
    )
    .eq("season_team_id", team.seasonTeamId)
    .order("jersey_number", { ascending: true, nullsFirst: false });

  const { data: marks } = await supabase
    .from("season_team_player_payment_marks")
    .select("season_team_player_id, marked_paid, notes")
    .eq("organization_id", team.organizationId);

  const markMap = new Map(
    (marks ?? []).map((m) => [
      m.season_team_player_id,
      { markedPaid: m.marked_paid, notes: m.notes },
    ])
  );

  return (rosterRows ?? []).map((row) => {
    const playerRel = row.players as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    const fullName = Array.isArray(playerRel)
      ? playerRel[0]?.full_name
      : playerRel?.full_name;
    const mark = markMap.get(row.id);
    return {
      id: row.id,
      fullName: fullName ?? "Jugador",
      jerseyNumber: row.jersey_number,
      isCaptain: row.is_captain,
      isViceCaptain: row.is_vice_captain,
      registrationStatus: row.registration_status,
      markedPaid: mark?.markedPaid ?? false,
      paymentNotes: mark?.notes ?? null,
    };
  });
}

export async function getCaptainMatchRescheduleRequest(
  organizationId: string,
  matchId: string
): Promise<CaptainRescheduleRequest | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_reschedule_requests")
    .select(
      "id, match_id, status, proposed_starts_at, proposed_field_id, proposed_by_profile_id, expires_at, responded_at, profiles!match_reschedule_requests_proposed_by_profile_id_fkey(display_name, email), fields(name, venues(name))"
    )
    .eq("organization_id", organizationId)
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const profileRel = data.profiles as
    | { display_name: string | null; email: string }
    | { display_name: string | null; email: string }[]
    | null;
  const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
  const fieldRel = data.fields as
    | {
        name: string;
        venues: { name: string } | { name: string }[] | null;
      }
    | null;
  const venueRel = fieldRel?.venues ?? null;
  const venue = Array.isArray(venueRel) ? venueRel[0] : venueRel;

  return {
    id: data.id,
    matchId: data.match_id,
    status: data.status,
    proposedStartsAt: data.proposed_starts_at,
    proposedFieldId: data.proposed_field_id,
    proposedFieldName: fieldRel?.name ?? null,
    proposedVenueName: venue?.name ?? null,
    proposedByProfileId: data.proposed_by_profile_id,
    proposedByDisplayName:
      profile?.display_name?.trim() || profile?.email || "Capitán",
    expiresAt: data.expires_at,
    respondedAt: data.responded_at,
  };
}

export async function getOpponentCaptainPhone(
  profileId: string,
  team: CaptainTeamLink,
  match: CaptainMatchListItem
): Promise<string | null> {
  const opponentTeamId = match.isOwnHome
    ? match.awaySeasonTeamId
    : match.homeSeasonTeamId;

  const supabase = await createClient();
  const { data: captainRow } = await supabase
    .from("season_team_players")
    .select("players(profile_id)")
    .eq("season_team_id", opponentTeamId)
    .eq("is_captain", true)
    .eq("registration_status", "active")
    .maybeSingle();

  if (!captainRow) return null;

  // profiles.phone is not in schema (Migration 021+). WhatsApp deep-links need it.
  void profileId;
  void team;
  void captainRow;
  return null;
}

export async function getCaptainInvitationByToken(
  profileId: string | null,
  profileEmail: string | null,
  token: string
): Promise<{
  preview: CaptainInvitationPreview | null;
  reason: "invalid" | "email_mismatch" | "ok" | "login_required";
}> {
  if (!profileId) {
    return { preview: null, reason: "login_required" };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("captain_invitations")
    .select("id, email, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) {
    return { preview: null, reason: "invalid" };
  }

  if (
    profileEmail &&
    profileEmail.toLowerCase() !== data.email.toLowerCase()
  ) {
    return { preview: null, reason: "email_mismatch" };
  }

  const isExpired =
    data.status === "expired" ||
    (data.status === "pending" &&
      new Date(data.expires_at).getTime() < Date.now());

  return {
    preview: {
      id: data.id,
      email: data.email,
      status: isExpired ? "expired" : data.status,
      expiresAt: data.expires_at,
      teamName: null,
      seasonName: null,
      organizationName: null,
      isExpired,
    },
    reason: "ok",
  };
}
