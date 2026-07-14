import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationById } from "@/lib/organizations/get-organization";
import { mapOrganizationBranding } from "@/lib/branding/map-organization-branding";
import { getOrganizationVenueStats } from "@/lib/venues/queries";
import { getOrganizationCompetitionStats } from "@/lib/competitions/queries";
import { getOrganizationTeamStats } from "@/lib/teams/queries";
import { getOrganizationMatchStats } from "@/lib/fixtures/queries";
import { OrganizationDashboardDemo } from "@/features/dashboard/OrganizationDashboardDemo";
import { notFound } from "next/navigation";

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

  const organization = await getOrganizationById(organizationId);
  if (!organization) notFound();

  const branding = mapOrganizationBranding(organization);
  const [venueStats, competitionStats, teamStats, matchStats] =
    await Promise.all([
      getOrganizationVenueStats(organizationId),
      getOrganizationCompetitionStats(organizationId),
      getOrganizationTeamStats(organizationId),
      getOrganizationMatchStats(organizationId),
    ]);

  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  return (
    <OrganizationDashboardDemo
      branding={branding}
      organizationId={organizationId}
      canManage={canManage}
      matchStats={matchStats}
      stats={{
        ...venueStats,
        competitions: competitionStats.competitions,
        seasons: competitionStats.seasons,
        teams: teamStats.teams,
        seasonEnrollments: teamStats.seasonEnrollments,
      }}
    />
  );
}
