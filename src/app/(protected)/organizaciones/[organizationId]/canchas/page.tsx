import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationFieldCards } from "@/lib/venues/queries";
import { formatLimitReachedMessage } from "@/lib/billing/tier-limits";
import { getOrganizationTierLimitStatus } from "@/lib/billing/tier-limits-queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { TierLimitLink } from "@/components/billing/TierLimitControls";
import { FieldCardGrid } from "@/components/venues/FieldCardGrid";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function FieldsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const fields = await getOrganizationFieldCards(organizationId);
  const tierStatus = canManage
    ? await getOrganizationTierLimitStatus(organizationId)
    : null;
  const canchasAtLimit = tierStatus?.atLimit.canchas_total ?? false;
  const canchasLimitMessage = canchasAtLimit
    ? formatLimitReachedMessage(
        "canchas_total",
        tierStatus?.limits.canchas_total ?? null
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Canchas"
        description={`${fields.length} cancha${fields.length === 1 ? "" : "s"} registrada${fields.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/organizaciones/${organizationId}/canchas/disponibilidad`}
                className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
              >
                Disponibilidad
              </Link>
              <TierLimitLink
                href={`/organizaciones/${organizationId}/canchas/nueva`}
                disabled={canchasAtLimit}
                disabledReason={canchasLimitMessage}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Nueva cancha
              </TierLimitLink>
            </div>
          ) : undefined
        }
      />
      <FieldCardGrid organizationId={organizationId} fields={fields} />
    </div>
  );
}
