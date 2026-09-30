import {
  goalsFromEvents,
  type MatchTimelineEvent,
} from "@/lib/matches/types";

export const SCORE_MISMATCH_CONFIRM_MESSAGE =
  "El marcador no coincide con los goles capturados. ¿Guardar de todos modos?";

export function countScoringEvents(
  events: Pick<MatchTimelineEvent, "voidedAt" | "eventType">[]
): number {
  return events.filter(
    (event) =>
      !event.voidedAt &&
      (event.eventType === "goal" || event.eventType === "own_goal")
  ).length;
}

export function scoreFromTimeline(
  events: MatchTimelineEvent[],
  homeSeasonTeamId: string,
  awaySeasonTeamId: string
): { home: number; away: number; scoringEventCount: number } {
  return {
    ...goalsFromEvents(events, homeSeasonTeamId, awaySeasonTeamId),
    scoringEventCount: countScoringEvents(events),
  };
}

export type ScoreManualSaveInput = {
  submittedHome: number;
  submittedAway: number;
  eventHome: number;
  eventAway: number;
  scoringEventCount: number;
  recalculateFromEvents: boolean;
  confirmMismatch: boolean;
};

export type ScoreManualSaveResult =
  | {
      ok: true;
      homeScore: number;
      awayScore: number;
      scoreManualOverride: boolean;
    }
  | { ok: false; message: string };

/**
 * Official score follows captured goals unless the user saves a different
 * number on purpose, or asks to recalculate.
 */
export function resolveScoreManualSave(
  input: ScoreManualSaveInput
): ScoreManualSaveResult {
  if (input.recalculateFromEvents) {
    return {
      ok: true,
      homeScore: input.eventHome,
      awayScore: input.eventAway,
      scoreManualOverride: false,
    };
  }

  const differs =
    input.submittedHome !== input.eventHome ||
    input.submittedAway !== input.eventAway;

  if (differs && input.scoringEventCount > 0 && !input.confirmMismatch) {
    return { ok: false, message: SCORE_MISMATCH_CONFIRM_MESSAGE };
  }

  return {
    ok: true,
    homeScore: input.submittedHome,
    awayScore: input.submittedAway,
    scoreManualOverride: differs,
  };
}
