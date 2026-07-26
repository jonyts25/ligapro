export type CaptainLeadershipRole = "captain" | "vice_captain";

export type CaptainTeamLink = {
  seasonTeamPlayerId: string;
  seasonTeamId: string;
  organizationId: string;
  seasonId: string;
  teamName: string;
  seasonName: string;
  competitionId: string;
  competitionName: string;
  leadershipRole: CaptainLeadershipRole;
};

export type CaptainMatchListItem = {
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
};

export type CaptainRosterPlayer = {
  id: string;
  fullName: string;
  jerseyNumber: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  registrationStatus: string;
  markedPaid: boolean;
  paymentNotes: string | null;
};

export type CaptainInvitationPreview = {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  teamName: string | null;
  seasonName: string | null;
  organizationName: string | null;
  isExpired: boolean;
};

export type CaptainRescheduleRequest = {
  id: string;
  matchId: string;
  status: string;
  proposedStartsAt: string;
  proposedFieldId: string | null;
  proposedFieldName: string | null;
  proposedVenueName: string | null;
  proposedByProfileId: string;
  proposedByDisplayName: string;
  expiresAt: string;
  respondedAt: string | null;
};

export type CaptainActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  inviteUrl?: string | null;
  whatsAppHref?: string | null;
};

export const initialCaptainActionState: CaptainActionState = {
  ok: false,
  message: null,
};
