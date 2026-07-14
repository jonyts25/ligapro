import { SectionHeader } from "@/components/ui/SectionHeader";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { getPublicSeasonStandings } from "@/lib/public-season/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
  }>;
};

export default async function PublicSeasonStandingsPage({ params }: PageProps) {
  const { organizationId, seasonSlug } = await params;
  const standings = await getPublicSeasonStandings(
    organizationId,
    seasonSlug
  );

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="posiciones"
    >
      <SectionHeader
        title="Posiciones"
        description="Clasificación publicada con marcador oficial."
      />
      <StandingsTable
        rows={standings.map((row) => ({
          key: `${row.position}-${row.teamName}`,
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
    </PublicSeasonShell>
  );
}
