export type OrganizationSeasonOption = {
  seasonId: string;
  competitionId: string;
  label: string;
  competitionName: string;
  createdAt: string;
  startsOn: string | null;
};

export function pickDefaultOrganizationSeason(
  seasons: OrganizationSeasonOption[]
): OrganizationSeasonOption | null {
  if (seasons.length === 0) return null;

  return [...seasons].sort((a, b) => {
    const aDate = a.startsOn ?? a.createdAt;
    const bDate = b.startsOn ?? b.createdAt;
    return bDate.localeCompare(aDate);
  })[0]!;
}

export function parseSeasonContextFromPathname(pathname: string): {
  organizationId: string;
  competitionId: string;
  seasonId: string;
} | null {
  const match = pathname.match(
    /\/organizaciones\/([^/]+)\/torneos\/([^/]+)\/temporadas\/([^/]+)/
  );
  if (!match) return null;
  return {
    organizationId: match[1]!,
    competitionId: match[2]!,
    seasonId: match[3]!,
  };
}

export function buildOrganizationEquiposHref(
  organizationId: string,
  seasonContext?: { seasonId: string; competitionId: string } | null
): string {
  const base = `/organizaciones/${organizationId}/equipos`;
  if (!seasonContext) return base;
  const params = new URLSearchParams({
    seasonId: seasonContext.seasonId,
    competitionId: seasonContext.competitionId,
  });
  return `${base}?${params.toString()}`;
}

export function resolveOrganizationSeasonSelection(
  seasons: OrganizationSeasonOption[],
  requestedSeasonId?: string,
  requestedCompetitionId?: string
): OrganizationSeasonOption | null {
  if (requestedSeasonId && requestedCompetitionId) {
    const match = seasons.find(
      (season) =>
        season.seasonId === requestedSeasonId &&
        season.competitionId === requestedCompetitionId
    );
    if (match) return match;
  }

  return pickDefaultOrganizationSeason(seasons);
}
