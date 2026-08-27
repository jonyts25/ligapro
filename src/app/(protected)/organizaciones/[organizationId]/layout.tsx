import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { roleLabel } from "@/lib/auth/validation";
import { getCaptainTeams } from "@/lib/auth/get-captain-teams";
import { AppShell } from "@/components/layout/AppShell";
import { DemoViewCaptainNotice } from "@/components/demo-view/DemoViewRoleNotice";
import { DemoViewShell } from "@/components/demo-view/DemoViewShell";
import { PlatformStaffNavLink } from "@/components/platform-billing/PlatformStaffLink";
import { getOrganizationById } from "@/lib/organizations/get-organization";
import { mapOrganizationBranding } from "@/lib/branding/map-organization-branding";
import { sanitizeAccentForCss } from "@/lib/branding/sanitize-accent";
import { getMyOfficialMatchAssignments } from "@/lib/matches/my-official-matches";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { notFound } from "next/navigation";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationLayout({
  children,
  params,
}: LayoutProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const organization = await getOrganizationById(organizationId);
  if (!organization) notFound();

  const branding = mapOrganizationBranding(organization);
  const safeAccent = sanitizeAccentForCss(branding.accentColor);

  const [platformStaff, captainTeams, officialAssignments] = await Promise.all([
    isPlatformStaff(user.id),
    getCaptainTeams(user.id),
    getMyOfficialMatchAssignments(organizationId, user.id),
  ]);
  const hasCaptainTeams = captainTeams.some(
    (team) => team.organizationId === organizationId
  );

  return (
    <DemoViewShell
      organizationId={organizationId}
      isPlatformStaff={platformStaff}
      hasCaptainTeams={hasCaptainTeams}
      hasOfficialAssignments={officialAssignments.length > 0}
    >
      <AppShell
        branding={{ ...branding, accentColor: safeAccent }}
        organizationId={organizationId}
        user={user}
        role={membership.role}
        roleLabel={roleLabel(membership.role)}
        pageTitle="Inicio"
        platformStaffNav={<PlatformStaffNavLink />}
      >
        <DemoViewCaptainNotice className="mb-4" />
        {children}
      </AppShell>
    </DemoViewShell>
  );
}
