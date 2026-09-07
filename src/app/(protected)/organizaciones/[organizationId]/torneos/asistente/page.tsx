import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  formatLimitReachedMessage,
  evaluateTierLimit,
} from "@/lib/billing/tier-limits";
import { getOrganizationTierLimitStatus } from "@/lib/billing/tier-limits-queries";
import { getWizardDefaultFieldCount } from "@/lib/tournament-wizard/actions";
import { TournamentWizardStep1Form } from "@/components/tournament-wizard/TournamentWizardStep1Form";
import { WizardStepIndicator } from "@/components/tournament-wizard/WizardStepIndicator";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function TournamentWizardStartPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const tierStatus = await getOrganizationTierLimitStatus(organizationId);
  const defaultFieldCount = await getWizardDefaultFieldCount(organizationId);
  const canchasAtLimit = tierStatus
    ? !evaluateTierLimit(tierStatus, "canchas_total").ok
    : false;
  const canchasLimitMessage = canchasAtLimit
    ? formatLimitReachedMessage(
        "canchas_total",
        tierStatus?.limits.canchas_total ?? null
      )
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Asistente de torneo"
        description="Crea tu torneo en pocos pasos. Las pantallas avanzadas siguen disponibles después."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Modo avanzado
          </Link>
        }
      />
      <WizardStepIndicator currentStep="inicio" />
      <TournamentWizardStep1Form
        organizationId={organizationId}
        defaultFieldCount={defaultFieldCount}
        canchasAtLimit={canchasAtLimit}
        canchasLimitMessage={canchasLimitMessage}
      />
    </div>
  );
}
