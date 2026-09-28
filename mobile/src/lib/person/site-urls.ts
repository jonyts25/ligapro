export function siteOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return configured ?? "http://localhost:3000";
}

export function buildAdminOrganizationUrl(organizationId: string): string {
  return `${siteOrigin()}/organizaciones/${organizationId}/inicio`;
}

export function buildPublicSeasonUrl(
  organizationId: string,
  seasonSlug: string,
): string {
  return `${siteOrigin()}/publico/${organizationId}/${seasonSlug}`;
}

export function buildCaptainPortalUrl(seasonTeamId: string): string {
  return `${siteOrigin()}/mi-equipo/${seasonTeamId}`;
}
