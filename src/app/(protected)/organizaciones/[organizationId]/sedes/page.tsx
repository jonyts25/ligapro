import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationVenues } from "@/lib/venues/queries";
import { formatLimitReachedMessage } from "@/lib/billing/tier-limits";
import { getOrganizationTierLimitStatus } from "@/lib/billing/tier-limits-queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { TierLimitLink } from "@/components/billing/TierLimitControls";
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
  const tierStatus = canManage
    ? await getOrganizationTierLimitStatus(organizationId)
    : null;
  const sedesAtLimit = tierStatus?.atLimit.sedes ?? false;
  const sedesLimitMessage = sedesAtLimit
    ? formatLimitReachedMessage("sedes", tierStatus?.limits.sedes ?? null)
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Sedes y canchas"
        description={`${venues.length} sede${venues.length === 1 ? "" : "s"} · ${totalFields} cancha${totalFields === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/organizaciones/${organizationId}/sedes/disponibilidad`}
                className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
              >
                Disponibilidad
              </Link>
              <TierLimitLink
                href={`/organizaciones/${organizationId}/sedes/nueva`}
                disabled={sedesAtLimit}
                disabledReason={sedesLimitMessage}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Nueva sede
              </TierLimitLink>
            </div>
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
