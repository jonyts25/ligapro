export const FIXTURE_TIMEZONE = "America/Mexico_City";

export type FixtureMode = "single" | "double";

export type MatchStatus =
  | "scheduled"
  | "in_progress"
  | "finished"
  | "cancelled"
  | "walkover";

export type EligibleSeasonTeam = {
  seasonTeamId: string;
  name: string;
  registrationStatus: string;
};

export type SeasonFixtureContext = {
  organizationId: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonName: string;
  formatType: string;
  supportsAutoFixture: boolean;
  matchDurationMinutes: number;
  minimumRestMinutes: number;
  slotMinutes: number;
  eligibleTeams: EligibleSeasonTeam[];
  existingMatchCount: number;
  canGenerate: boolean;
};

export type MatchScheduleInfo = {
  reservationId: string | null;
  fieldId: string | null;
  fieldName: string | null;
  venueId: string | null;
  venueName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  fieldIsActive: boolean | null;
  venueIsActive: boolean | null;
};

export type MatchListItem = {
  id: string;
  seasonId: string;
  organizationId: string;
  roundNumber: number | null;
  legNumber: number | null;
  sequenceInRound: number | null;
  roundLabel: string | null;
  status: MatchStatus;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  isProgrammed: boolean;
  schedule: MatchScheduleInfo;
};

export type FixtureRoundGroup = {
  roundNumber: number;
  legNumber: number | null;
  matches: MatchListItem[];
  byeSeasonTeamIds: string[];
  byeNames: string[];
};

export type SeasonFixtureStats = {
  totalMatches: number;
  scheduledMatches: number;
  pendingMatches: number;
  fixtureGenerated: boolean;
};

export type FieldAvailabilityInterval = {
  startsAt: string;
  endsAt: string;
};

export type ActiveVenueOption = {
  id: string;
  name: string;
};

export type ActiveFieldOption = {
  id: string;
  name: string;
  venueId: string;
  venueName: string;
  isActive: boolean;
  venueIsActive: boolean;
};

export type MatchSchedulingDetails = {
  match: MatchListItem;
  seasonName: string;
  competitionId: string;
  competitionName: string;
  slotMinutes: number;
  matchDurationMinutes: number;
  minimumRestMinutes: number;
};

export type FixtureActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | null>;
};

export const initialFixtureActionState: FixtureActionState = {
  ok: false,
  message: null,
};

export type OrganizationMatchStats = {
  totalMatches: number;
  scheduledMatches: number;
  upcoming: Array<{
    id: string;
    seasonId: string;
    competitionId: string;
    homeName: string;
    awayName: string;
    startsAt: string;
    venueName: string | null;
    fieldName: string | null;
  }>;
};

export function supportsAutoRoundRobin(formatType: string): boolean {
  return formatType === "round_robin" || formatType === "round_robin_double";
}

export function programmingLabel(isProgrammed: boolean): string {
  return isProgrammed ? "Programado" : "Pendiente";
}
