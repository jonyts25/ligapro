import { SectionHeader } from "@/components/ui/SectionHeader";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { TopScorersTable } from "@/components/standings/TopScorersTable";
import { DataCompletenessWarning } from "@/components/standings/DataCompletenessWarning";
import { getPublicSeasonScorers } from "@/lib/public-season/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
  }>;
};

export default async function PublicSeasonScorersPage({ params }: PageProps) {
  const { organizationId, seasonSlug } = await params;
  const scorers = await getPublicSeasonScorers(organizationId, seasonSlug);

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="goleadores"
    >
      <SectionHeader
        title="Goleadores"
        description="Goles anotados capturados en la temporada."
      />
      <DataCompletenessWarning
        title="Depende de la captura"
        description="El listado público refleja solo goles registrados como eventos. Puede diferir del marcador oficial si la captura está incompleta."
      />
      <TopScorersTable
        rows={scorers.map((row, index) => ({
          key: `${row.position}-${row.playerName}-${index}`,
          position: row.position,
          playerName: row.playerName,
          teamName: row.teamName,
          goals: row.goals,
        }))}
      />
    </PublicSeasonShell>
  );
}
