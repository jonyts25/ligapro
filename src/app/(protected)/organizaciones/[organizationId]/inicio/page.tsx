import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationById } from "@/lib/organizations/get-organization";
import { mapOrganizationBranding } from "@/lib/branding/map-organization-branding";
import { getOrganizationVenueStats } from "@/lib/venues/queries";
import { OrganizationDashboardDemo } from "@/features/dashboard/OrganizationDashboardDemo";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationHomePage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationMembership(user.id, organizationId);

  const organization = await getOrganizationById(organizationId);
  if (!organization) notFound();

  const branding = mapOrganizationBranding(organization);
  const stats = await getOrganizationVenueStats(organizationId);

  return (
    <OrganizationDashboardDemo
      branding={branding}
      organizationId={organizationId}
      stats={stats}
    />
  );
}
