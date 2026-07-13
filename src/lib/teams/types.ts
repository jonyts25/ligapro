export const SEASON_TEAM_STATUS_OPTIONS = [
  { value: "registered", label: "Inscrito" },
  { value: "confirmed", label: "Confirmado" },
  { value: "withdrawn", label: "Retirado" },
] as const;

export const ROSTER_STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "suspended", label: "Suspendido" },
] as const;

export type SeasonTeamRegistrationStatus =
  (typeof SEASON_TEAM_STATUS_OPTIONS)[number]["value"];
export type RosterRegistrationStatus =
  (typeof ROSTER_STATUS_OPTIONS)[number]["value"];

export type TeamRecord = {
  id: string;
  organization_id: string;
  name: string;
};

export type PlayerRecord = {
  id: string;
  organization_id: string;
  full_name: string;
  profile_id: string | null;
};

export type SeasonTeamRecord = {
  id: string;
  season_id: string;
  team_id: string;
  organization_id: string;
  display_name: string | null;
  group_name: string | null;
  registration_status: SeasonTeamRegistrationStatus;
};

export type RosterEntryRecord = {
  id: string;
  season_team_id: string;
  player_id: string;
  organization_id: string;
  jersey_number: number | null;
  is_captain: boolean;
  registration_status: RosterRegistrationStatus;
};

export type TeamListItem = TeamRecord & {
  seasonEnrollmentCount: number;
  latestSeasonName: string | null;
};

export type TeamDetail = TeamRecord & {
  enrollments: Array<{
    seasonTeamId: string;
    seasonId: string;
    competitionId: string;
    seasonName: string;
    competitionName: string;
    registration_status: SeasonTeamRegistrationStatus;
  }>;
};

export type SeasonTeamListItem = SeasonTeamRecord & {
  teamName: string;
  playerCount: number;
  captainName: string | null;
};

export type RosterListItem = RosterEntryRecord & {
  full_name: string;
};

export type SeasonTeamDetail = SeasonTeamRecord & {
  teamName: string;
  seasonName: string;
  competitionId: string;
  competitionName: string;
  roster: RosterListItem[];
  activePlayerCount: number;
  captainName: string | null;
};

export type SeasonRosterStats = {
  teamCount: number;
  activePlayerCount: number;
  teamsWithCaptain: number;
};

export type TeamsActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | number | boolean | null>;
};

export const initialTeamsActionState: TeamsActionState = {
  ok: false,
  message: null,
};

export function seasonTeamStatusLabel(value: string): string {
  return (
    SEASON_TEAM_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export function rosterStatusLabel(value: string): string {
  return ROSTER_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function seasonTeamStatusVariant(
  value: string
): "default" | "success" | "warning" | "info" {
  if (value === "confirmed") return "success";
  if (value === "withdrawn") return "warning";
  return "info";
}

export function displaySeasonTeamName(
  displayName: string | null,
  teamName: string
): string {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed : teamName;
}
