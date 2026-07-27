import {
  SEASON_VISIBILITY_OPTIONS,
  type SeasonDetail,
  type SeasonVisibility,
} from "@/lib/competitions/types";

export function isSeasonArchived(visibility: string): boolean {
  return visibility === "archived";
}

/** Visibility values selectable in create/edit form — not via dedicated archive flow. */
export const SEASON_VISIBILITY_EDITABLE_OPTIONS = SEASON_VISIBILITY_OPTIONS.filter(
  (opt) => opt.value !== "archived"
);

export const SEASON_REACTIVATE_OPTIONS = SEASON_VISIBILITY_OPTIONS.filter(
  (opt) => opt.value !== "archived"
);

export function canManageActiveSeason(
  season: Pick<SeasonDetail, "visibility">,
  canManage: boolean
): boolean {
  return canManage && !isSeasonArchived(season.visibility);
}

export function splitSeasonsByArchive<T extends { visibility: string }>(
  seasons: T[]
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const season of seasons) {
    if (isSeasonArchived(season.visibility)) {
      archived.push(season);
    } else {
      active.push(season);
    }
  }
  return { active, archived };
}

export function pickLatestActiveSeason<T extends { visibility: string }>(
  seasons: T[]
): T | null {
  return seasons.find((s) => !isSeasonArchived(s.visibility)) ?? null;
}

export function isEditableVisibility(value: string): value is SeasonVisibility {
  return SEASON_VISIBILITY_EDITABLE_OPTIONS.some((o) => o.value === value);
}

export function seasonDetailPath(
  organizationId: string,
  competitionId: string,
  seasonId: string
): string {
  return `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
}
