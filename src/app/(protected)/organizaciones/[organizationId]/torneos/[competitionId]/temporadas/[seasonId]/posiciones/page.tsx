export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { canManageActiveSeason } from "@/lib/competitions/season-visibility";
import {
  getSeasonScoreMismatches,
  getSeasonStandings,
} from "@/lib/standings/queries";
import { getSeasonGroupsForStandings } from "@/lib/groups/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { GroupStandingsTabs } from "@/components/standings/GroupStandingsTabs";
import { ScoreEventsMismatchAlert } from "@/components/standings/ScoreEventsMismatchAlert";
import { DataCompletenessWarning } from "@/components/standings/DataCompletenessWarning";
import { SeasonExportButtons } from "@/components/export/ExportButtons";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
  searchParams: Promise<{ grupo?: string }>;
};

export default async function SeasonStandingsPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const { grupo: grupoParam } = await searchParams;
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

  const canManageActive = canManageActiveSeason(season, canManage);

  if (season.format_type === "knockout") {
    redirect(
      `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/bracket`
    );
  }

  const groups =
    season.format_type === "groups_knockout"
      ? await getSeasonGroupsForStandings(organizationId, seasonId)
      : [];

  const selectedGroupId =
    groups.find((g) => g.id === grupoParam)?.id ?? groups[0]?.id ?? null;

  const [standings, mismatches] = await Promise.all([
    getSeasonStandings(
      seasonId,
      season.format_type === "groups_knockout" ? selectedGroupId : null
    ),
    canManageActive
      ? getSeasonScoreMismatches(organizationId, seasonId)
      : Promise.resolve([]),
  ]);

  const finishedWithScore = standings.some((r) => r.played > 0);
  const basePath = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/posiciones`;

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
        canManage={canManage}
        canManageActive={canManageActive}
        formatType={season.format_type}
      />

      {groups.length > 0 && selectedGroupId && (
        <GroupStandingsTabs
          groups={groups}
          selectedGroupId={selectedGroupId}
          basePath={basePath}
        />
      )}

      {canManageActive && mismatches.length > 0 && (
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

      <SeasonExportButtons
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        exportKind="standings"
      />

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
