import { isCaptureWindowOpen } from "@/lib/matches/capture-window";
import {
  resolveUpdateResultPermissions,
  validateUpdateResultAuthorization,
} from "@/lib/matches/update-result-permissions";
import type { MatchCapturePermissions, MatchStatusValue } from "@/lib/matches/types";

export type GuestOfficialInviteRow = {
  matchOfficialId: string;
  matchId: string;
  organizationId: string;
  seasonId: string;
  competitionId: string;
  guestName: string | null;
  role: string;
  status: string;
  inviteExpiresAt: string;
};

export type GuestInviteValidation =
  | { ok: true; invite: GuestOfficialInviteRow }
  | { ok: false; message: string };

const EXPIRED_MESSAGE =
  "El enlace de invitación expiró o ya fue utilizado.";
const INVALID_MESSAGE = "Enlace de invitación inválido.";
const WRONG_MATCH_MESSAGE =
  "Este enlace no corresponde a este partido.";

export function mapGuestInviteRpcRow(row: {
  match_official_id: string;
  match_id: string;
  organization_id: string;
  season_id: string;
  competition_id: string;
  guest_name: string | null;
  role: string;
  status: string;
  invite_expires_at: string;
}): GuestOfficialInviteRow {
  return {
    matchOfficialId: row.match_official_id,
    matchId: row.match_id,
    organizationId: row.organization_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    guestName: row.guest_name,
    role: row.role,
    status: row.status,
    inviteExpiresAt: row.invite_expires_at,
  };
}

export function classifyGuestInviteError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("not valid for this match")) {
    return WRONG_MATCH_MESSAGE;
  }
  if (
    normalized.includes("expired") ||
    normalized.includes("already used") ||
    normalized.includes("no longer active")
  ) {
    return EXPIRED_MESSAGE;
  }
  if (normalized.includes("invalid guest invite")) {
    return INVALID_MESSAGE;
  }
  return message;
}

export function guestInviteHasName(invite: GuestOfficialInviteRow): boolean {
  return Boolean(invite.guestName?.trim());
}

export function guestInviteIsActive(invite: GuestOfficialInviteRow, now = Date.now()): boolean {
  if (!["assigned", "confirmed"].includes(invite.status)) return false;
  if (invite.role !== "referee") return false;
  const expiresMs = new Date(invite.inviteExpiresAt).getTime();
  return !Number.isNaN(expiresMs) && expiresMs > now;
}

export function validateGuestInviteForMatch(
  invite: GuestOfficialInviteRow,
  matchId: string,
  now = Date.now()
): GuestInviteValidation {
  if (invite.matchId !== matchId) {
    return { ok: false, message: WRONG_MATCH_MESSAGE };
  }
  if (!guestInviteIsActive(invite, now)) {
    return { ok: false, message: EXPIRED_MESSAGE };
  }
  return { ok: true, invite };
}

export function computeGuestOfficialInviteExpiry(
  matchStartsAt: string | null,
  now = new Date()
): Date {
  const sevenDays = new Date(now);
  sevenDays.setUTCDate(sevenDays.getUTCDate() + 7);

  if (!matchStartsAt) {
    return sevenDays;
  }

  const matchStart = new Date(matchStartsAt);
  if (Number.isNaN(matchStart.getTime())) {
    return sevenDays;
  }

  const dayAfterMatch = new Date(matchStart);
  dayAfterMatch.setUTCDate(dayAfterMatch.getUTCDate() + 1);

  return dayAfterMatch.getTime() < sevenDays.getTime()
    ? dayAfterMatch
    : sevenDays;
}

export function getGuestMatchCapturePermissions(
  invite: GuestOfficialInviteRow,
  windowContext: {
    startsAt: string | null;
    calendarConfirmed: boolean;
  },
  currentMatchStatus: MatchStatusValue
): MatchCapturePermissions {
  const hasName = guestInviteHasName(invite);
  const isActive = guestInviteIsActive(invite);
  const isConfirmedReferee = hasName && isActive && invite.role === "referee";

  const resultPermissions = resolveUpdateResultPermissions({
    isOrgAdmin: false,
    isTournamentAdmin: false,
    isConfirmedReferee,
    currentMatchStatus,
  });

  const captureWindowOpen =
    windowContext.calendarConfirmed === true &&
    isCaptureWindowOpen(windowContext.startsAt);

  return {
    canCaptureEvents: isConfirmedReferee,
    canUpdateResult: resultPermissions.canUpdateResult,
    closeOnlyResultUpdate: true,
    canManageOfficials: false,
    canManageSeasonRoles: false,
    canVoidEvents: false,
    captureWindowOpen,
    captureWindowBypass: false,
    actorLabel: hasName
      ? `Árbitro invitado · ${invite.guestName}`
      : "Árbitro invitado",
  };
}

export function validateGuestUpdateResultAuthorization(input: {
  statusRaw: MatchStatusValue;
  currentStatus: MatchStatusValue;
}): { ok: true } | { ok: false; message: string } {
  return validateUpdateResultAuthorization({
    isOrgAdmin: false,
    isTournamentAdmin: false,
    isConfirmedReferee: true,
    statusRaw: input.statusRaw,
    currentStatus: input.currentStatus,
  });
}
