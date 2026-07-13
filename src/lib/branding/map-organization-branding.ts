import type {
  OrganizationBranding,
  OrganizationRecord,
} from "@/types/branding";
import { sanitizeAccentForCss } from "@/lib/branding/sanitize-accent";

const BUCKET = "organization-logos";

export function getOrganizationLogoPublicUrl(
  logoPath: string | null | undefined
): string | null {
  if (!logoPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${logoPath}`;
}

export function mapOrganizationBranding(
  organization: Pick<OrganizationRecord, "name" | "brand_color" | "logo_path">
): OrganizationBranding {
  return {
    name: organization.name,
    shortName: organization.name,
    logoUrl: getOrganizationLogoPublicUrl(organization.logo_path),
    accentColor: sanitizeAccentForCss(organization.brand_color),
  };
}
