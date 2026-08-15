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

/** Single option shown in season create/edit form (publish is a separate action). */
export const SEASON_FORM_VISIBILITY_OPTIONS = SEASON_VISIBILITY_OPTIONS.filter(
  (opt) => opt.value === "draft"
);

// TODO: Migración pendiente — decidir si unificar temporadas existentes con
// visibility 'private' o 'unlisted' a 'draft' en BD (confirmar con producto).
export function isLegacyUnpublishedVisibility(visibility: string): boolean {
  return visibility === "private" || visibility === "unlisted";
}

export function isSeasonPubliclyVisible(visibility: string): boolean {
  return visibility === "public";
}

export function canPublishSeasonVisibility(visibility: string): boolean {
  return (
    visibility === "draft" ||
    isLegacyUnpublishedVisibility(visibility)
  );
}

export function displaySeasonVisibilityLabel(visibility: string): string {
  if (visibility === "draft" || isLegacyUnpublishedVisibility(visibility)) {
    return "Borrador";
  }
  return (
    SEASON_VISIBILITY_OPTIONS.find((opt) => opt.value === visibility)?.label ??
    visibility
  );
}

export function formVisibilityHiddenValue(
  season: Pick<SeasonDetail, "visibility"> | undefined
): string {
  if (!season) return "draft";
  return season.visibility;
}

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
  return (
    value === "draft" ||
    isLegacyUnpublishedVisibility(value) ||
    value === "public"
  );
}

export function canDeleteSeason(season: {
  visibility: string;
  teamCount: number;
}): boolean {
  return season.visibility === "draft" && season.teamCount === 0;
}

export function canDeleteCompetition(seasonCount: number): boolean {
  return seasonCount === 0;
}

export function seasonDetailPath(
  organizationId: string,
  competitionId: string,
  seasonId: string
): string {
  return `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
}
