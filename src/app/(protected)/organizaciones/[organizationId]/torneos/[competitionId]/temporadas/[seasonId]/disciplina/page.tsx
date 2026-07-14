export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { getSeasonDisciplineSummary } from "@/lib/standings/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { DisciplineTable } from "@/components/standings/DisciplineTable";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonDisciplinePage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  await requireOrganizationMembership(user.id, organizationId);

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

  const rows = await getSeasonDisciplineSummary(seasonId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Disciplina"
        description={`${season.name} · ${season.competitionName}`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="disciplina"
      />

      <DisciplineTable
        rows={rows.map((row) => ({
          key: row.playerId,
          playerName: row.playerName,
          teamName: row.teamName,
          yellowCards: row.yellowCards,
          redCards: row.redCards,
          matchesRemaining: row.matchesRemaining,
          suspensionStatus: row.suspensionStatus,
          isSuspended: row.activeSuspensions > 0,
        }))}
      />
    </div>
  );
}
