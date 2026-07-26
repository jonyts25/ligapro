export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import {
  getFieldAvailabilityOverview,
  getOrganizationFieldsForOverview,
  getWeekStartFromDate,
} from "@/lib/venues/availability-overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { FieldAvailabilityOverviewClient } from "@/components/venues/FieldAvailabilityOverviewClient";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ fieldId?: string; weekStart?: string }>;
};

export default async function FieldAvailabilityOverviewPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
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
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Disponibilidad de canchas"
          description="Solo administradores pueden consultar esta vista."
        />
      </div>
    );
  }

  const fields = await getOrganizationFieldsForOverview(organizationId);
  const selectedFieldId = query.fieldId ?? fields[0]?.id ?? "";
  const weekStart = query.weekStart ?? getWeekStartFromDate();

  const overview = selectedFieldId
    ? await getFieldAvailabilityOverview(
        organizationId,
        selectedFieldId,
        weekStart
      )
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Disponibilidad de canchas"
        description="Cruza horario habitual, reservas de partidos y bloqueos por torneo. Solo lectura."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/sedes`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver a sedes
          </Link>
        }
      />
      {fields.length === 0 ? (
        <p className="text-sm text-muted">
          No hay canchas registradas. Crea sedes y canchas primero.
        </p>
      ) : (
        <FieldAvailabilityOverviewClient
          organizationId={organizationId}
          fields={fields}
          selectedFieldId={selectedFieldId}
          weekStart={weekStart}
          overview={overview}
        />
      )}
    </div>
  );
}
