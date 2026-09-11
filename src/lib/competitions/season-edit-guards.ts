import type { SeasonDetail } from "@/lib/competitions/types";

export const FORMAT_LOCKED_TOOLTIP =
  "No puedes cambiar el formato porque ya hay partidos generados o programados.";

export const MATCH_DURATION_LOCKED_TOOLTIP =
  "No puedes cambiar la duración del partido porque ya hay partidos generados o programados.";

export function isSeasonFormatLocked(
  season: Pick<SeasonDetail, "readiness">
): boolean {
  return (
    season.readiness.fixtureGenerated || season.readiness.scheduledMatches > 0
  );
}

export function isSeasonMatchDurationLocked(
  season: Pick<SeasonDetail, "readiness">
): boolean {
  return isSeasonFormatLocked(season);
}
