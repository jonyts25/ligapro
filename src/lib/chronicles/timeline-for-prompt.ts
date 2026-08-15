import { redactPlayerNameForPublic } from "@/lib/players/redact-name";
import type { MatchTimelineEvent } from "@/lib/matches/types";

/**
 * Builds the timeline copy fed to the AI chronicle prompt.
 * Youth competitions redact player names here only — admin/capture views keep full names.
 */
export function buildChronicleTimelineForPrompt(
  timeline: MatchTimelineEvent[],
  isYouthCompetition: boolean
): MatchTimelineEvent[] {
  const activeEvents = timeline.filter((event) => event.voidedAt == null);
  if (!isYouthCompetition) return activeEvents;

  return activeEvents.map((event) => ({
    ...event,
    playerName: redactPlayerNameForPublic(event.playerName),
  }));
}
