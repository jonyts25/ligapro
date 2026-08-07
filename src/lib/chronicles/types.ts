import type { MatchTimelineEvent } from "@/lib/matches/types";

export type ChronicleJobStatus =
  | "pending"
  | "processing"
  | "done"
  | "error";

export type MatchChronicleRow = {
  id: string;
  matchId: string;
  content: string;
  tier: string;
  isPublished: boolean;
  generatedAt: string;
  modelUsed: string | null;
};

export type MatchChronicleJobRow = {
  id: string;
  status: ChronicleJobStatus;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type ChronicleActionState = {
  ok: boolean;
  message: string | null;
  needsConfirm?: boolean;
};

export const initialChronicleActionState: ChronicleActionState = {
  ok: false,
  message: null,
};

export type BuildChroniclePromptInput = {
  homeTeamName: string;
  awayTeamName: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeScore: number;
  awayScore: number;
  events: MatchTimelineEvent[];
};
