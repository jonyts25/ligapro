import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { getAvailableTeamsForSeason } from "@/lib/teams/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonEnrollmentForm } from "@/components/teams/SeasonEnrollmentForm";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function EnrollTeamPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

  const availableTeams = await getAvailableTeamsForSeason(
    organizationId,
    seasonId
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Inscribir equipo"
        description={`${season.competitionName} · ${season.name}`}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <SeasonEnrollmentForm
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        availableTeams={availableTeams}
      />
    </div>
  );
}
