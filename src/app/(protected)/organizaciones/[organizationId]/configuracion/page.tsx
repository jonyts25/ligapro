import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getOrganizationById } from "@/lib/organizations/get-organization";
import { mapOrganizationBranding } from "@/lib/branding/map-organization-branding";
import { PageHeader } from "@/components/ui/PageHeader";
import { OrganizationBrandingForm } from "@/components/organizations/OrganizationBrandingForm";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ setup?: string }>;
};

export default async function OrganizationSettingsPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { setup } = await searchParams;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const organization = await getOrganizationById(organizationId);
  if (!organization) notFound();

  const branding = mapOrganizationBranding(organization);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Configuración"
        description="Identidad visual de tu organización."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/inicio`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Volver al inicio
          </Link>
        }
      />
      <OrganizationBrandingForm
        organizationId={organizationId}
        initialName={organization.name}
        initialBrandColor={organization.brand_color}
        branding={branding}
        logoPath={organization.logo_path}
        setup={setup === "1"}
      />
    </div>
  );
}
