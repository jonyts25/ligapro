import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getWizardContext } from "@/lib/tournament-wizard/queries";
import { TournamentWizardScheduleStep } from "@/components/tournament-wizard/TournamentWizardScheduleStep";
import { WizardStepIndicator } from "@/components/tournament-wizard/WizardStepIndicator";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function TournamentWizardSchedulePage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const context = await getWizardContext(
    organizationId,
    competitionId,
    seasonId
  );
  if (!context) {
    redirect(`/organizaciones/${organizationId}/torneos/asistente`);
  }

  if (context.teams.length < 2) {
    redirect(
      `/organizaciones/${organizationId}/torneos/asistente/${competitionId}/${seasonId}/equipos`
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="¿Qué días juegan?"
        description="Un solo horario para todas las canchas de tu torneo."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/canchas`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Modo avanzado
          </Link>
        }
      />
      <WizardStepIndicator currentStep="horarios" />
      <TournamentWizardScheduleStep
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        fieldIds={context.fields.map((field) => field.id)}
        fieldNames={context.fields.map((field) => field.name)}
      />
    </div>
  );
}
