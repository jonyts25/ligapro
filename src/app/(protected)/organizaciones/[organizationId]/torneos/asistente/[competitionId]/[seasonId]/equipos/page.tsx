import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getWizardContext } from "@/lib/tournament-wizard/queries";
import { TournamentWizardTeamsStep } from "@/components/tournament-wizard/TournamentWizardTeamsStep";
import { WizardStepIndicator } from "@/components/tournament-wizard/WizardStepIndicator";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
  searchParams: Promise<{ equipos?: string }>;
};

export default async function TournamentWizardTeamsPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const { equipos } = await searchParams;
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

  if (context.teams.length >= 2) {
    redirect(
      `/organizaciones/${organizationId}/torneos/asistente/${competitionId}/${seasonId}/jugadores`
    );
  }

  const suggestedTeamCount = Number.parseInt(String(equipos ?? "4"), 10);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Agrega tus equipos"
        description={`${context.competitionName} · pega los nombres de tus equipos`}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Modo avanzado
          </Link>
        }
      />
      <WizardStepIndicator currentStep="equipos" />
      <TournamentWizardTeamsStep
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        suggestedTeamCount={
          Number.isInteger(suggestedTeamCount) && suggestedTeamCount >= 2
            ? suggestedTeamCount
            : 4
        }
      />
    </div>
  );
}
