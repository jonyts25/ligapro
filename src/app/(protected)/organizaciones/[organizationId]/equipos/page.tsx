import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { listOrganizationSeasonOptions } from "@/lib/organizations/queries";
import { resolveOrganizationSeasonSelection } from "@/lib/organizations/season-picker";
import { getSeasonTeams } from "@/lib/teams/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { OrganizationSeasonPicker } from "@/components/organizations/OrganizationSeasonPicker";
import { SeasonTeamList } from "@/components/teams/SeasonTeamList";
import { EmptyState } from "@/components/ui/EmptyState";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ seasonId?: string; competitionId?: string }>;
};

export default async function TeamsPage({ params, searchParams }: PageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const seasons = await listOrganizationSeasonOptions(organizationId);
  const selectedSeason = resolveOrganizationSeasonSelection(
    seasons,
    query.seasonId,
    query.competitionId
  );

  if (
    selectedSeason &&
    !query.seasonId &&
    !query.competitionId
  ) {
    redirect(
      `/organizaciones/${organizationId}/equipos?seasonId=${selectedSeason.seasonId}&competitionId=${selectedSeason.competitionId}`
    );
  }

  const seasonTeams = selectedSeason
    ? await getSeasonTeams(organizationId, selectedSeason.seasonId)
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Equipos"
        description={
          selectedSeason
            ? `${selectedSeason.competitionName} · ${seasonTeams.length} equipo${seasonTeams.length === 1 ? "" : "s"} inscrito${seasonTeams.length === 1 ? "" : "s"}`
            : "Selecciona un torneo para ver sus equipos."
        }
        actions={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/equipos/nuevo`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nuevo equipo
            </Link>
          ) : undefined
        }
      />

      {seasons.length === 0 ? (
        <EmptyState
          title="Sin torneos activos"
          description="Crea un torneo para inscribir equipos."
        />
      ) : (
        <>
          <Suspense fallback={null}>
            <OrganizationSeasonPicker
              seasons={seasons.map((season) => ({
                seasonId: season.seasonId,
                competitionId: season.competitionId,
                label: season.label,
                competitionName: season.competitionName,
              }))}
              selectedSeasonId={selectedSeason?.seasonId ?? seasons[0]!.seasonId}
            />
          </Suspense>

          {selectedSeason && (
            <SeasonTeamList
              organizationId={organizationId}
              competitionId={selectedSeason.competitionId}
              seasonId={selectedSeason.seasonId}
              seasonTeams={seasonTeams}
              canManage={canManage}
            />
          )}
        </>
      )}
    </div>
  );
}
