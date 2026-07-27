import { SectionHeader } from "@/components/ui/SectionHeader";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { PublicGroupStandingsTabs } from "@/components/standings/GroupStandingsTabs";
import { KnockoutBracketView } from "@/components/knockout/KnockoutBracketView";
import { buildPublicKnockoutBracket } from "@/lib/knockout/public-bracket";
import {
  getPublicSeasonGroupsList,
  getPublicSeasonMatches,
  getPublicSeasonOverview,
  getPublicSeasonStandings,
} from "@/lib/public-season/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
  }>;
  searchParams: Promise<{ grupo?: string }>;
};

export default async function PublicSeasonStandingsPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, seasonSlug } = await params;
  const { grupo: grupoParam } = await searchParams;

  const overview = await getPublicSeasonOverview(organizationId, seasonSlug);
  if (!overview) return null;

  const formatType = overview.formatType;

  if (formatType === "knockout") {
    const matches = await getPublicSeasonMatches(organizationId, seasonSlug);
    const bracketData = buildPublicKnockoutBracket(matches);

    return (
      <PublicSeasonShell
        organizationId={organizationId}
        seasonSlug={seasonSlug}
        active="posiciones"
        formatType={formatType}
      >
        <SectionHeader
          title="Eliminatoria"
          description="Cuadro de eliminación directa con marcador oficial."
        />
        <KnockoutBracketView data={bracketData} />
      </PublicSeasonShell>
    );
  }

  const groups =
    formatType === "groups_knockout"
      ? await getPublicSeasonGroupsList(organizationId, seasonSlug)
      : [];

  const selectedGroupName =
    groups.find((g) => g.name === grupoParam)?.name ?? groups[0]?.name ?? null;

  const standings = await getPublicSeasonStandings(
    organizationId,
    seasonSlug,
    formatType === "groups_knockout" ? selectedGroupName : null
  );

  const basePath = `/publico/${organizationId}/${seasonSlug}/posiciones`;

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="posiciones"
      formatType={formatType}
    >
      <SectionHeader
        title="Posiciones"
        description="Clasificación publicada con marcador oficial."
      />

      {groups.length > 0 && selectedGroupName && (
        <PublicGroupStandingsTabs
          groups={groups}
          selectedGroupName={selectedGroupName}
          basePath={basePath}
        />
      )}

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
