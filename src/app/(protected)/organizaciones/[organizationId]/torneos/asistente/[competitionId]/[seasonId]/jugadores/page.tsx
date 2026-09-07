import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getWizardContext } from "@/lib/tournament-wizard/queries";
import { TournamentWizardPlayersStep } from "@/components/tournament-wizard/TournamentWizardPlayersStep";
import { WizardStepIndicator } from "@/components/tournament-wizard/WizardStepIndicator";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function TournamentWizardPlayersPage({ params }: PageProps) {
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Agrega jugadores a cada equipo"
        description="Opcional — puedes omitir este paso y agregar jugadores después."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Modo avanzado
          </Link>
        }
      />
      <WizardStepIndicator currentStep="jugadores" />
      <TournamentWizardPlayersStep
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        teams={context.teams}
      />
    </div>
  );
}
