import type { OrganizationBranding } from "@/types/branding";
import { PLATFORM_NAME } from "@/lib/platform/config";

export const LIGAPRO_DEFAULT_BRANDING: OrganizationBranding = {
  name: PLATFORM_NAME,
  shortName: PLATFORM_NAME,
  logoUrl: null,
  accentColor: null,
};

/** Demo branding for F0 shell preview only — not persisted. */
export const DEMO_ORGANIZATION_BRANDING: OrganizationBranding = {
  name: "Liga Deportiva del Bajío",
  shortName: "LDB",
  logoUrl: null,
  accentColor: "#2dd4bf",
};
