import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getVenueWithFields } from "@/lib/venues/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { VenueForm } from "@/components/venues/VenueForm";

type PageProps = {
  params: Promise<{ organizationId: string; venueId: string }>;
};

export default async function EditVenuePage({ params }: PageProps) {
  const { organizationId, venueId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const venue = await getVenueWithFields(organizationId, venueId);
  if (!venue) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Editar sede"
        description={venue.name}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/sedes/${venueId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <VenueForm organizationId={organizationId} mode="edit" venue={venue} />
    </div>
  );
}
