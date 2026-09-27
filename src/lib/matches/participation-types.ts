export const MATCH_PARTICIPATION_STATUS_OPTIONS = [
  { value: "called", label: "Convocado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "declined", label: "Declinó" },
  { value: "played", label: "Jugó" },
  { value: "no_show", label: "No presentado" },
] as const;

export type MatchParticipationStatus =
  (typeof MATCH_PARTICIPATION_STATUS_OPTIONS)[number]["value"];

export type MatchParticipantRow = {
  id: string;
  matchId: string;
  seasonTeamPlayerId: string;
  seasonTeamId: string;
  organizationId: string;
  status: MatchParticipationStatus;
  calledByProfileId: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  playerName: string;
  jerseyNumber: number | null;
};

export function participationStatusLabel(value: string): string {
  return (
    MATCH_PARTICIPATION_STATUS_OPTIONS.find((option) => option.value === value)
      ?.label ?? value
  );
}
