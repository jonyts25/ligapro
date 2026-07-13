import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { roleLabel } from "@/lib/auth/validation";
import { AppShell } from "@/components/layout/AppShell";
import { getOrganizationById } from "@/lib/organizations/get-organization";
import { mapOrganizationBranding } from "@/lib/branding/map-organization-branding";
import { sanitizeAccentForCss } from "@/lib/branding/sanitize-accent";
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

  return (
    <AppShell
      branding={{ ...branding, accentColor: safeAccent }}
      organizationId={organizationId}
      user={user}
      role={membership.role}
      roleLabel={roleLabel(membership.role)}
      pageTitle="Inicio"
    >
      {children}
    </AppShell>
  );
}
