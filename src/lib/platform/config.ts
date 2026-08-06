/** Single source for platform branding — change values here to rebrand app-wide. */
export const PLATFORM_NAME = "Ligera";
export const PLATFORM_SHORT_NAME = "Ligera";
export const PLATFORM_TAGLINE = "Administración de ligas amateur";
export const PLATFORM_DESCRIPTION =
  "Plataforma de administración de ligas amateur";
/** Monogram shown in favicons and default org avatar when no logo is set. */
export const PLATFORM_ICON_INITIALS = "Li";
/** Lowercase identifier for health checks and telemetry (not user-facing). */
export const PLATFORM_SERVICE_ID = "ligera";

/** Public marketing / home entry point for "Powered by" attribution. */
export const PLATFORM_HOME_URL = "/";

export function platformPageTitle(pageTitle: string): string {
  return `${pageTitle} · ${PLATFORM_NAME}`;
}

export function platformInternalSectionLabel(): string {
  return `${PLATFORM_NAME} interno`;
}
