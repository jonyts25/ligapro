import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { getSeasonTeams } from "@/lib/teams/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonTeamList } from "@/components/teams/SeasonTeamList";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonTeamsPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

  const seasonTeams = await getSeasonTeams(organizationId, seasonId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Equipos de la temporada"
        description={`${season.competitionName} · ${season.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Volver a temporada
            </Link>
            {canManage && (
              <Link
                href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos/inscribir`}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Inscribir equipo
              </Link>
            )}
          </div>
        }
      />
      <p className="text-sm text-text-secondary">
        {seasonTeams.length} equipo{seasonTeams.length === 1 ? "" : "s"}{" "}
        inscrito{seasonTeams.length === 1 ? "" : "s"}
      </p>
      <SeasonTeamList
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        seasonTeams={seasonTeams}
        canManage={canManage}
      />
    </div>
  );
}
