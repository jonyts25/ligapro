import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationVenues } from "@/lib/venues/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { VenueList } from "@/components/venues/VenueList";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function VenuesPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const { venues, totalFields } = await getOrganizationVenues(organizationId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Sedes y canchas"
        description={`${venues.length} sede${venues.length === 1 ? "" : "s"} · ${totalFields} cancha${totalFields === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/sedes/nueva`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nueva sede
            </Link>
          ) : undefined
        }
      />
      <VenueList
        organizationId={organizationId}
        venues={venues}
        canManage={canManage}
      />
    </div>
  );
}
