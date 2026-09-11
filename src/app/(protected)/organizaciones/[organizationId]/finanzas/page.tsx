import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { listOrganizationSeasonOptions } from "@/lib/organizations/queries";
import {
  buildOrganizationScopedHref,
  pickDefaultOrganizationSeason,
} from "@/lib/organizations/season-picker";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationFinanceHubPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const seasons = await listOrganizationSeasonOptions(organizationId);
  const defaultSeason = pickDefaultOrganizationSeason(seasons);

  if (defaultSeason) {
    redirect(
      buildOrganizationScopedHref(organizationId, "finanzas", defaultSeason)
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Finanzas"
        description="Cargos, pagos e inscripciones por torneo."
      />
      <EmptyState
        title="Sin torneos activos"
        description="El ledger financiero se gestiona por torneo."
      />
    </div>
  );
}
