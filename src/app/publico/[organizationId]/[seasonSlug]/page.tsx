import { SectionHeader } from "@/components/ui/SectionHeader";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { PublicUpcomingMatches } from "@/components/public-season/PublicUpcomingMatches";
import { PublicRecentResults } from "@/components/public-season/PublicRecentResults";
import { PublicStandingsPreview } from "@/components/public-season/PublicStandingsPreview";
import { KnockoutBracketView } from "@/components/knockout/KnockoutBracketView";
import { buildPublicKnockoutBracket } from "@/lib/knockout/public-bracket";
import {
  getPublicSeasonMatches,
  getPublicSeasonOverview,
  getPublicSeasonStandings,
} from "@/lib/public-season/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
  }>;
};

export default async function PublicSeasonHomePage({ params }: PageProps) {
  const { organizationId, seasonSlug } = await params;

  const overview = await getPublicSeasonOverview(organizationId, seasonSlug);
  if (!overview) return null;

  const [matches, standings] = await Promise.all([
    getPublicSeasonMatches(organizationId, seasonSlug),
    overview.formatType === "knockout"
      ? Promise.resolve([])
      : getPublicSeasonStandings(organizationId, seasonSlug),
  ]);

  const bracketData =
    overview.formatType === "knockout"
      ? buildPublicKnockoutBracket(matches)
      : null;

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="inicio"
      formatType={overview.formatType}
    >
      <section className="space-y-3">
        <SectionHeader
          title="Próximos partidos"
          description="Agenda pública de la temporada."
        />
        <PublicUpcomingMatches matches={matches} />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Resultados recientes"
          description="Últimos partidos con marcador oficial."
        />
        <PublicRecentResults matches={matches} />
      </section>

      {bracketData ? (
        <section className="space-y-3">
          <SectionHeader
            title="Eliminatoria"
            description="Cuadro de eliminación directa."
          />
          <KnockoutBracketView data={bracketData} />
        </section>
      ) : (
        <PublicStandingsPreview
          rows={standings}
          organizationId={organizationId}
          seasonSlug={seasonSlug}
        />
      )}
    </PublicSeasonShell>
  );
}
