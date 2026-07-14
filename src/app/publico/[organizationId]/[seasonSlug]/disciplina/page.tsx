import { SectionHeader } from "@/components/ui/SectionHeader";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { DisciplineTable } from "@/components/standings/DisciplineTable";
import { getPublicSeasonDiscipline } from "@/lib/public-season/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
  }>;
};

export default async function PublicSeasonDisciplinePage({
  params,
}: PageProps) {
  const { organizationId, seasonSlug } = await params;
  const rows = await getPublicSeasonDiscipline(organizationId, seasonSlug);

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="disciplina"
    >
      <SectionHeader
        title="Disciplina"
        description="Suspensiones activas publicadas."
      />
      <DisciplineTable
        publicMode
        rows={rows.map((row, index) => ({
          key: `${row.playerName}-${row.teamName}-${index}`,
          playerName: row.playerName,
          teamName: row.teamName,
          isSuspended: row.isSuspended,
          matchesRemaining: row.matchesRemaining,
        }))}
      />
    </PublicSeasonShell>
  );
}
