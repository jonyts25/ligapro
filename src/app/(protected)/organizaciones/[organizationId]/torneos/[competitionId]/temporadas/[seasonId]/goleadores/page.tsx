export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { getSeasonTopScorers } from "@/lib/standings/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { TopScorersTable } from "@/components/standings/TopScorersTable";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { DataCompletenessWarning } from "@/components/standings/DataCompletenessWarning";

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
  await requireOrganizationMembership(user.id, organizationId);

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

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
      />

      <DataCompletenessWarning
        title="Depende de la captura de eventos"
        description="Solo cuentan los eventos de tipo gol. Los autogoles no suman al goleo. Si el marcador oficial no coincide con los eventos, revisa la captura del partido."
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
