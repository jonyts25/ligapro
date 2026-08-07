export type PublicSeasonOverview = {
  organizationName: string;
  organizationLogoPath: string | null;
  organizationBrandColor: string | null;
  competitionName: string;
  seasonName: string;
  seasonSlug: string;
  formatType: string;
  startsOn: string | null;
  endsOn: string | null;
  visibility: string;
};

export type PublicStandingRow = {
  position: number;
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

export type PublicMatchRow = {
  matchId: string | null;
  roundLabel: string | null;
  roundNumber: number | null;
  sequenceInRound: number | null;
  homeTeamName: string;
  awayTeamName: string;
  status: string;
  calendarStatus: string;
  homeScore: number | null;
  awayScore: number | null;
  startsAt: string | null;
  venueName: string | null;
  fieldName: string | null;
  knockoutRoundNumber: number | null;
  bracketSlot: number | null;
  legNumber: number | null;
};

export type PublicScorerRow = {
  position: number;
  playerName: string;
  teamName: string;
  goals: number;
};

export type PublicDisciplineRow = {
  playerName: string;
  teamName: string;
  isSuspended: boolean;
  matchesRemaining: number;
};

export type PublicSeasonTab =
  | "inicio"
  | "calendario"
  | "posiciones"
  | "goleadores"
  | "disciplina";

export type PublicMatchDetail = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  startsAt: string | null;
  venueName: string | null;
  fieldName: string | null;
  roundLabel: string | null;
  roundNumber: number | null;
  legNumber: number | null;
};

export type PublicMatchEventRow = {
  minute: number;
  eventType: string;
  playerName: string;
  teamName: string;
};

export type PublicMatchChronicle = {
  content: string;
  tier: string;
  generatedAt: string;
};
