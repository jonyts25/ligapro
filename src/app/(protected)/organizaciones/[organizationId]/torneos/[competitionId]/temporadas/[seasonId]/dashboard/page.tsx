export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  getSeasonDisciplineSummary,
  getSeasonStandings,
  getSeasonTopScorers,
} from "@/lib/standings/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { TopScorersTable } from "@/components/standings/TopScorersTable";
import { DisciplineTable } from "@/components/standings/DisciplineTable";
import { SectionHeader } from "@/components/ui/SectionHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonDashboardPage({ params }: PageProps) {
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

  const [standings, scorers, discipline] = await Promise.all([
    getSeasonStandings(seasonId),
    getSeasonTopScorers(seasonId),
    getSeasonDisciplineSummary(seasonId),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Dashboard de liga"
        description={`${season.name} · ${season.competitionName} · Vista de solo lectura`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="dashboard"
        canManage={canManage}
      />

      <section className="space-y-3">
        <SectionHeader title="Posiciones" />
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
      </section>

      <section className="space-y-3">
        <SectionHeader title="Goleo" />
        <TopScorersTable
          rows={scorers.map((row) => ({
            key: row.playerId,
            position: row.position,
            playerName: row.playerName,
            teamName: row.teamName,
            goals: row.goals,
          }))}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Disciplina" />
        <DisciplineTable
          rows={discipline.map((row) => ({
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
      </section>
    </div>
  );
}
