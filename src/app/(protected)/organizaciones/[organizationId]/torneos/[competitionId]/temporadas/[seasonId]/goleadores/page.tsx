export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { canManageActiveSeason } from "@/lib/competitions/season-visibility";
import { getSeasonTopScorers } from "@/lib/standings/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { TopScorersTable } from "@/components/standings/TopScorersTable";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { DataCompletenessWarning } from "@/components/standings/DataCompletenessWarning";
import { SeasonExportButtons } from "@/components/export/ExportButtons";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonTopScorersPage({ params }: PageProps) {
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

  const canManageActive = canManageActiveSeason(season, canManage);

  const scorers = await getSeasonTopScorers(seasonId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Goleadores"
        description={`${season.name} · ${season.competitionName}`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="goleadores"
        canManage={canManage}
        canManageActive={canManageActive}
        formatType={season.format_type}
      />

      <DataCompletenessWarning
        title="Depende de la captura de eventos"
        description="Solo cuentan los eventos de tipo gol. Los autogoles no suman al goleo. Si el marcador oficial no coincide con los eventos, revisa la captura del partido."
      />

      <SeasonExportButtons
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        exportKind="scorers"
      />

      <TopScorersTable
        rows={scorers.map((row) => ({
          key: row.playerId,
          position: row.position,
          playerName: row.playerName,
          teamName: row.teamName,
          goals: row.goals,
        }))}
      />
    </div>
  );
}
