import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { OrganizationDashboardDemo } from "@/features/dashboard/OrganizationDashboardDemo";
import { LIGAPRO_DEFAULT_BRANDING } from "@/lib/branding/defaults";
import type { OrganizationBranding } from "@/types/branding";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationHomePage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );

  const branding: OrganizationBranding = {
    name: membership.organizationName,
    shortName: membership.organizationName,
    logoUrl: null,
    accentColor: LIGAPRO_DEFAULT_BRANDING.accentColor,
  };

  return <OrganizationDashboardDemo branding={branding} />;
}
