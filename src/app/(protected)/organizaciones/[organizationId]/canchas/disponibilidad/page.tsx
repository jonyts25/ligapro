export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationAvailabilityGridData } from "@/lib/venues/availability-grid-data";
import { OrganizationAvailabilityGrid } from "@/components/venues/OrganizationAvailabilityGrid";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationAvailabilityGridPage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  if (!canManage) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Disponibilidad de canchas"
          description="Solo administradores pueden consultar esta vista."
        />
      </div>
    );
  }

  const model = await getOrganizationAvailabilityGridData(organizationId);

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <PageHeader
        title="Disponibilidad de canchas"
        description="Grilla semanal de horarios habituales y bloqueos por torneo. Solo lectura."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/canchas`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver a canchas
          </Link>
        }
      />
      {model.rows.length === 0 ? (
        <p className="text-sm text-muted">
          No hay canchas registradas. Crea canchas primero.
        </p>
      ) : (
        <OrganizationAvailabilityGrid model={model} />
      )}
    </div>
  );
}
