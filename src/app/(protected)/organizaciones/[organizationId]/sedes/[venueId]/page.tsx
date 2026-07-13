import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getVenueWithFields } from "@/lib/venues/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/venues/FieldList";

type PageProps = {
  params: Promise<{ organizationId: string; venueId: string }>;
};

export default async function VenueDetailPage({ params }: PageProps) {
  const { organizationId, venueId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const venue = await getVenueWithFields(organizationId, venueId);
  if (!venue) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={venue.name}
        description={venue.address ?? "Sin dirección registrada"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organizaciones/${organizationId}/sedes`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Todas las sedes
            </Link>
            {canManage && (
              <Link
                href={`/organizaciones/${organizationId}/sedes/${venueId}/editar`}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Editar sede
              </Link>
            )}
          </div>
        }
      />

      <Card className="flex flex-wrap items-center gap-3">
        <StatusBadge
          label={venue.is_active ? "Activa" : "Inactiva"}
          variant={venue.is_active ? "success" : "warning"}
        />
        <p className="text-sm text-text-secondary">
          {venue.fields.length} cancha
          {venue.fields.length === 1 ? "" : "s"}
        </p>
      </Card>

      <FieldList
        organizationId={organizationId}
        venueId={venue.id}
        venueActive={venue.is_active}
        fields={venue.fields}
        canManage={canManage}
      />
    </div>
  );
}
