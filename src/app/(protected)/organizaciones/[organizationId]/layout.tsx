import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { roleLabel } from "@/lib/auth/validation";
import { AppShell } from "@/components/layout/AppShell";
import { LIGAPRO_DEFAULT_BRANDING } from "@/lib/branding/defaults";
import type { OrganizationBranding } from "@/types/branding";

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

  const branding: OrganizationBranding = {
    name: membership.organizationName,
    shortName: membership.organizationName,
    logoUrl: null,
    accentColor: LIGAPRO_DEFAULT_BRANDING.accentColor,
  };

  return (
    <AppShell
      branding={branding}
      organizationId={organizationId}
      user={user}
      roleLabel={roleLabel(membership.role)}
      pageTitle="Inicio"
    >
      {children}
    </AppShell>
  );
}
