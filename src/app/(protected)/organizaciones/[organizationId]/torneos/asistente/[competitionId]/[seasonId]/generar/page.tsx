import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getWizardContext } from "@/lib/tournament-wizard/queries";
import { TournamentWizardGenerateStep } from "@/components/tournament-wizard/TournamentWizardGenerateStep";
import { WizardStepIndicator } from "@/components/tournament-wizard/WizardStepIndicator";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function TournamentWizardGeneratePage({ params }: PageProps) {
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
        title="Genera tu fixture"
        description="Último paso — crearemos el calendario de partidos."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/fixture/generar`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Modo avanzado
          </Link>
        }
      />
      <WizardStepIndicator currentStep="generar" />
      <TournamentWizardGenerateStep
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        competitionName={context.competitionName}
        teamCount={context.teams.length}
        canGenerate={context.canGenerateFixture}
        fixtureGenerated={context.fixtureGenerated}
      />
    </div>
  );
}
