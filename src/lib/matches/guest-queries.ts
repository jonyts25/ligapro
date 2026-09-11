import { createClient } from "@/lib/supabase/server";
import {
  classifyGuestInviteError,
  getGuestMatchCapturePermissions,
  guestInviteHasName,
  mapGuestInviteRpcRow,
  type GuestOfficialInviteRow,
} from "@/lib/matches/guest-official";
import type {
  MatchCapturePermissions,
  MatchDisciplineItem,
  MatchEventType,
  MatchRosterPlayer,
  MatchStatusValue,
  MatchTimelineEvent,
} from "@/lib/matches/types";

export type GuestMatchSnapshot = {
  matchId: string;
  status: MatchStatusValue;
  homeScore: number | null;
  awayScore: number | null;
  calendarStatus: string;
  homeName: string;
  awayName: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  startsAt: string | null;
};

export type GuestMatchCaptureContext = {
  invite: GuestOfficialInviteRow;
  snapshot: GuestMatchSnapshot;
  permissions: MatchCapturePermissions;
  timeline: MatchTimelineEvent[];
  discipline: MatchDisciplineItem[];
  roster: MatchRosterPlayer[];
  needsName: boolean;
};

async function fetchGuestInvite(
  token: string
): Promise<GuestOfficialInviteRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_official_invite", {
    p_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.length) {
    return null;
  }

  return mapGuestInviteRpcRow(data[0]!);
}

async function fetchGuestTimeline(token: string): Promise<MatchTimelineEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_guest_match_timeline", {
    p_token: token,
  });

  return (data ?? []).map((row) => ({
    id: row.event_id,
    eventType: row.event_type as MatchEventType,
    minute: row.minute,
    notes: row.notes,
    createdAt: row.created_at,
    playerName: row.player_name,
    teamName: row.team_name,
    seasonTeamId: row.season_team_id,
    seasonTeamPlayerId: row.season_team_player_id,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  }));
}

async function fetchGuestRoster(token: string): Promise<MatchRosterPlayer[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_guest_match_roster", {
    p_token: token,
  });

  return (data ?? []).map((row) => ({
    seasonTeamPlayerId: row.season_team_player_id,
    seasonTeamId: row.season_team_id,
    playerId: row.player_id,
    playerName: row.player_name ?? "Jugador",
    jerseyNumber: row.jersey_number,
    registrationStatus: row.registration_status,
    photoPath: row.photo_path,
    verificationStatus: row.verification_status ?? "not_required",
    photoUrl: null,
  }));
}

async function fetchGuestMatchSnapshot(
  token: string
): Promise<GuestMatchSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_match_snapshot", {
    p_token: token,
  });

  if (error || !data?.length) {
    return null;
  }

  const row = data[0]!;
  return {
    matchId: row.match_id,
    status: row.status as MatchStatusValue,
    homeScore: row.home_score,
    awayScore: row.away_score,
    calendarStatus: row.calendar_status,
    homeName: row.home_name,
    awayName: row.away_name,
    homeSeasonTeamId: row.home_season_team_id,
    awaySeasonTeamId: row.away_season_team_id,
    startsAt: row.starts_at,
  };
}

export async function getGuestMatchCaptureContext(
  token: string
): Promise<
  | { ok: true; context: GuestMatchCaptureContext }
  | { ok: false; message: string }
> {
  try {
    const [invite, snapshot] = await Promise.all([
      fetchGuestInvite(token),
      fetchGuestMatchSnapshot(token),
    ]);

    if (!invite || !snapshot) {
      return { ok: false, message: "Enlace de invitación inválido." };
    }

    const needsName = !guestInviteHasName(invite);
    const permissions = getGuestMatchCapturePermissions(
      invite,
      {
        startsAt: snapshot.startsAt,
        calendarConfirmed: snapshot.calendarStatus === "confirmado",
      },
      snapshot.status
    );

    const [timeline, roster] = needsName
      ? [[], []]
      : await Promise.all([
          fetchGuestTimeline(token),
          fetchGuestRoster(token),
        ]);
    const discipline: MatchDisciplineItem[] = [];

    return {
      ok: true,
      context: {
        invite,
        snapshot,
        permissions,
        timeline,
        discipline,
        roster,
        needsName,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo validar la invitación.";
    return { ok: false, message: classifyGuestInviteError(message) };
  }
}
