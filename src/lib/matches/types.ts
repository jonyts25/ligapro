export const SEASON_ROLE_OPTIONS = [
  { value: "tournament_admin", label: "Admin de torneo" },
  { value: "referee", label: "Árbitro" },
  { value: "delegate", label: "Delegado" },
] as const;

export type SeasonRoleValue = (typeof SEASON_ROLE_OPTIONS)[number]["value"];

export const MATCH_OFFICIAL_ROLE_OPTIONS = [
  { value: "referee", label: "Árbitro" },
  { value: "delegate", label: "Delegado" },
  { value: "assistant", label: "Asistente (informativo)" },
  { value: "scorekeeper", label: "Anotador (informativo)" },
] as const;

export type MatchOfficialRole =
  (typeof MATCH_OFFICIAL_ROLE_OPTIONS)[number]["value"];

export const MATCH_OFFICIAL_STATUS_OPTIONS = [
  { value: "assigned", label: "Asignado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "declined", label: "Rechazado" },
] as const;

export type MatchOfficialStatus =
  (typeof MATCH_OFFICIAL_STATUS_OPTIONS)[number]["value"];

export const MATCH_EVENT_TYPE_OPTIONS = [
  { value: "goal", label: "Gol" },
  { value: "own_goal", label: "Autogol" },
  { value: "yellow_card", label: "Tarjeta amarilla" },
  { value: "red_card", label: "Tarjeta roja" },
  { value: "substitution_in", label: "Entra" },
  { value: "substitution_out", label: "Sale" },
  { value: "injury", label: "Lesión" },
] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPE_OPTIONS)[number]["value"];

export const MATCH_STATUS_OPTIONS = [
  { value: "scheduled", label: "Programado" },
  { value: "in_progress", label: "En curso" },
  { value: "finished", label: "Finalizado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "walkover", label: "Walkover" },
] as const;

export type MatchStatusValue = (typeof MATCH_STATUS_OPTIONS)[number]["value"];

export type CaptureActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | number | null>;
};

export const initialCaptureActionState: CaptureActionState = {
  ok: false,
  message: null,
};

export type OrgMemberOption = {
  profileId: string;
  displayName: string;
  email: string;
  orgRole: string;
};

export type SeasonRoleListItem = {
  id: string;
  profileId: string;
  role: SeasonRoleValue;
  displayName: string;
  email: string;
};

export type MatchOfficialListItem = {
  id: string;
  profileId: string;
  role: MatchOfficialRole;
  status: MatchOfficialStatus;
  displayName: string;
  email: string;
  hasRequiredSeasonRole: boolean;
};

export type MatchTimelineEvent = {
  id: string;
  eventType: MatchEventType;
  minute: number;
  notes: string | null;
  createdAt: string;
  playerName: string;
  teamName: string;
  seasonTeamId: string;
  seasonTeamPlayerId: string;
};

export type MatchDisciplineItem = {
  id: string;
  suspensionType: string;
  status: string;
  matchesRemaining: number;
  matchesServed: number;
  playerName: string;
  notes: string | null;
  sourceMatchEventId: string | null;
};

export type MatchCapturePermissions = {
  canCaptureEvents: boolean;
  canUpdateResult: boolean;
  canManageOfficials: boolean;
  canManageSeasonRoles: boolean;
  actorLabel: string;
};

export type MatchRosterPlayer = {
  seasonTeamPlayerId: string;
  seasonTeamId: string;
  playerName: string;
  jerseyNumber: number | null;
  registrationStatus: string;
};

export function eventTypeLabel(value: string): string {
  return (
    MATCH_EVENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export function matchStatusLabel(value: string): string {
  return MATCH_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function seasonRoleLabel(value: string): string {
  return SEASON_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function officialRoleLabel(value: string): string {
  return (
    MATCH_OFFICIAL_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

/** Reasonable transitions when no formal state machine exists. */
export function allowedStatusTransitions(
  current: MatchStatusValue
): MatchStatusValue[] {
  switch (current) {
    case "scheduled":
      return ["scheduled", "in_progress", "finished", "cancelled", "walkover"];
    case "in_progress":
      return ["in_progress", "finished", "cancelled", "walkover"];
    case "finished":
      return ["finished"];
    case "cancelled":
      return ["cancelled"];
    case "walkover":
      return ["walkover"];
    default:
      return [current];
  }
}

export function goalsFromEvents(
  events: MatchTimelineEvent[],
  homeSeasonTeamId: string,
  awaySeasonTeamId: string
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const event of events) {
    if (event.eventType === "goal") {
      if (event.seasonTeamId === homeSeasonTeamId) home += 1;
      if (event.seasonTeamId === awaySeasonTeamId) away += 1;
    } else if (event.eventType === "own_goal") {
      // own goal credited to the opposing team visually
      if (event.seasonTeamId === homeSeasonTeamId) away += 1;
      if (event.seasonTeamId === awaySeasonTeamId) home += 1;
    }
  }
  return { home, away };
}
