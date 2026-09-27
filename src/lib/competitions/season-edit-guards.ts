import type { SeasonDetail, SeasonFormatType } from "@/lib/competitions/types";

export type ParsedSeasonUpdateFields = {
  formatType: SeasonFormatType;
  matchDurationMinutes: number;
  groupsAdvancePerGroup: number | null;
};

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

export function applySeasonUpdateLocks<T extends ParsedSeasonUpdateFields>(
  season: Pick<SeasonDetail, "format_type" | "readiness" | "rules">,
  parsed: T
): T {
  const formatLocked = isSeasonFormatLocked(season);
  const durationLocked = isSeasonMatchDurationLocked(season);

  return {
    ...parsed,
    formatType: formatLocked ? season.format_type : parsed.formatType,
    matchDurationMinutes: durationLocked
      ? season.rules.match_duration_minutes
      : parsed.matchDurationMinutes,
    groupsAdvancePerGroup: formatLocked
      ? season.rules.groups_advance_per_group
      : parsed.groupsAdvancePerGroup,
  };
}
