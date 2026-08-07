export type MatchTeamStatsRow = {
  seasonTeamId: string;
  teamName: string;
  shots: number | null;
  shotsOnTarget: number | null;
  possessionPct: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
};

export type MatchContextRow = {
  attendance: number | null;
  weather: string | null;
  refereeName: string | null;
  highlightNote: string | null;
};

export type MatchStatsCaptureContext = {
  home: MatchTeamStatsRow;
  away: MatchTeamStatsRow;
  context: MatchContextRow;
  canEdit: boolean;
};

export type MatchStatsActionState = {
  ok: boolean;
  message: string | null;
};

export const initialMatchStatsActionState: MatchStatsActionState = {
  ok: false,
  message: null,
};
