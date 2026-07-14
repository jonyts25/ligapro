export type StandingRow = {
  position: number;
  seasonTeamId: string;
  teamId: string;
  teamName: string;
  registrationStatus: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  recentForm: string;
};

export type TopScorerRow = {
  position: number;
  playerId: string;
  playerName: string;
  seasonTeamId: string;
  teamName: string;
  goals: number;
};

export type DisciplineSummaryRow = {
  playerId: string;
  playerName: string;
  seasonTeamId: string;
  teamName: string;
  yellowCards: number;
  redCards: number;
  activeSuspensions: number;
  matchesRemaining: number;
  suspensionStatus: string | null;
};

export type ScoreMismatchRow = {
  matchId: string;
  homeName: string;
  awayName: string;
  officialHome: number;
  officialAway: number;
  eventsHome: number;
  eventsAway: number;
};

export function seasonTeamStatusLabel(value: string): string {
  switch (value) {
    case "registered":
      return "Inscrito";
    case "confirmed":
      return "Confirmado";
    case "withdrawn":
      return "Retirado";
    default:
      return value;
  }
}

export function suspensionStatusLabel(value: string | null): string {
  switch (value) {
    case "active":
      return "Activa";
    case "served":
      return "Cumplida";
    case "waived":
      return "Condornada";
    default:
      return "—";
  }
}
