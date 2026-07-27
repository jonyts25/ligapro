export type KnockoutMatchRow = {
  id: string;
  bracketSlot: number;
  legNumber: number;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
};

export type KnockoutTieRow = {
  id: string;
  bracketSlot: number;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string | null;
  penaltyWinnerSeasonTeamId: string | null;
  matches: KnockoutMatchRow[];
};

export type KnockoutRoundRow = {
  id: string;
  roundNumber: number;
  roundLabel: string;
  bracketSize: number;
  isTwoLegs: boolean;
  ties: KnockoutTieRow[];
};

export type KnockoutBracketData = {
  rounds: KnockoutRoundRow[];
  championSeasonTeamId: string | null;
  championTeamName: string | null;
  teamNames: Record<string, string>;
};

export type KnockoutActionState = {
  ok: boolean;
  message: string | null;
};

export const initialKnockoutActionState: KnockoutActionState = {
  ok: false,
  message: null,
};
