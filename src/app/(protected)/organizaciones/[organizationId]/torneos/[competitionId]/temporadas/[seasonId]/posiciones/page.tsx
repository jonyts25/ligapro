export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  getSeasonScoreMismatches,
  getSeasonStandings,
} from "@/lib/standings/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { ScoreEventsMismatchAlert } from "@/components/standings/ScoreEventsMismatchAlert";
import { DataCompletenessWarning } from "@/components/standings/DataCompletenessWarning";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonStandingsPage({ params }: PageProps) {
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

  const [standings, mismatches] = await Promise.all([
    getSeasonStandings(seasonId),
    canManage
      ? getSeasonScoreMismatches(organizationId, seasonId)
      : Promise.resolve([]),
  ]);

  const finishedWithScore = standings.some((r) => r.played > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Posiciones"
        description={`${season.name} · ${season.competitionName}`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="posiciones"
      />

      {canManage && mismatches.length > 0 && (
        <ScoreEventsMismatchAlert
          mismatches={mismatches}
          organizationId={organizationId}
          competitionId={competitionId}
          seasonId={seasonId}
        />
      )}

      {!finishedWithScore && (
        <DataCompletenessWarning
          title="Tabla pendiente de resultados"
          description="La clasificación se actualiza cuando hay partidos finalizados o walkover con ambos marcadores oficiales."
        />
      )}

      <StandingsTable
        rows={standings.map((row) => ({
          key: row.seasonTeamId,
          position: row.position,
          teamName: row.teamName,
          registrationStatus: row.registrationStatus,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
          recentForm: row.recentForm,
        }))}
      />
    </div>
  );
}
