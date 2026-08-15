export type JornadaSummaryRow = {
  id: string;
  seasonId: string;
  roundNumber: number;
  content: string;
  isPublished: boolean;
  modelUsed: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JornadaSummaryJobRow = {
  id: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type JornadaSummaryActionState = {
  ok: boolean;
  message: string | null;
  needsConfirm?: boolean;
};

export const initialJornadaSummaryActionState: JornadaSummaryActionState = {
  ok: false,
  message: null,
};

export type BuildJornadaPromptMatch = {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  eventsSummary: string;
};

export type BuildJornadaPromptStanding = {
  position: number;
  teamName: string;
  points: number;
  played: number;
};

export type BuildJornadaPromptInput = {
  seasonName: string;
  roundNumber: number;
  matches: BuildJornadaPromptMatch[];
  standingsAfter: BuildJornadaPromptStanding[];
};
