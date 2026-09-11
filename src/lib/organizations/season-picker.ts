export type OrganizationSeasonOption = {
  seasonId: string;
  competitionId: string;
  label: string;
  competitionName: string;
  createdAt: string;
  startsOn: string | null;
};

export type OrganizationSeasonContext = {
  seasonId: string;
  competitionId: string;
};

export type OrganizationScopedSection =
  | "equipos"
  | "calendario"
  | "partidos"
  | "finanzas"
  | "disciplina";

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
  const standardMatch = pathname.match(
    /\/organizaciones\/([^/]+)\/torneos\/([^/]+)\/temporadas\/([^/]+)/
  );
  if (standardMatch) {
    return {
      organizationId: standardMatch[1]!,
      competitionId: standardMatch[2]!,
      seasonId: standardMatch[3]!,
    };
  }

  const wizardMatch = pathname.match(
    /\/organizaciones\/([^/]+)\/torneos\/asistente\/([^/]+)\/([^/]+)/
  );
  if (wizardMatch) {
    return {
      organizationId: wizardMatch[1]!,
      competitionId: wizardMatch[2]!,
      seasonId: wizardMatch[3]!,
    };
  }

  return null;
}

export function buildOrganizationScopedHref(
  organizationId: string,
  section: OrganizationScopedSection,
  seasonContext?: OrganizationSeasonContext | null
): string {
  if (section === "equipos") {
    return buildOrganizationEquiposHref(organizationId, seasonContext);
  }

  const hub = `/organizaciones/${organizationId}/${section}`;
  if (!seasonContext) return hub;

  const seasonBase = `/organizaciones/${organizationId}/torneos/${seasonContext.competitionId}/temporadas/${seasonContext.seasonId}`;

  if (section === "calendario" || section === "partidos") {
    return `${seasonBase}/calendario`;
  }

  if (section === "finanzas") {
    return `${seasonBase}/finanzas`;
  }

  if (section === "disciplina") {
    return `${seasonBase}/disciplina`;
  }

  return hub;
}

export function buildOrganizationEquiposHref(
  organizationId: string,
  seasonContext?: OrganizationSeasonContext | null
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

  if (requestedSeasonId) {
    const match = seasons.find((season) => season.seasonId === requestedSeasonId);
    if (match) return match;
  }

  if (requestedCompetitionId) {
    const competitionSeasons = seasons.filter(
      (season) => season.competitionId === requestedCompetitionId
    );
    const match = pickDefaultOrganizationSeason(competitionSeasons);
    if (match) return match;
  }

  return pickDefaultOrganizationSeason(seasons);
}

export function organizationSeasonQueryString(
  season: OrganizationSeasonContext
): string {
  const params = new URLSearchParams({
    seasonId: season.seasonId,
    competitionId: season.competitionId,
  });
  return params.toString();
}

export function shouldCanonicalizeOrganizationSeasonQuery(
  seasons: OrganizationSeasonOption[],
  requestedSeasonId?: string,
  requestedCompetitionId?: string
): OrganizationSeasonOption | null {
  const selected = resolveOrganizationSeasonSelection(
    seasons,
    requestedSeasonId,
    requestedCompetitionId
  );
  if (!selected) return null;

  const queryMatches =
    selected.seasonId === requestedSeasonId &&
    selected.competitionId === requestedCompetitionId;

  if (queryMatches) return null;

  return selected;
}
