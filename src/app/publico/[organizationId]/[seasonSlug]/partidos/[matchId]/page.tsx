import { notFound } from "next/navigation";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { PublicMatchDetailView } from "@/components/public-season/PublicMatchDetailView";
import {
  getPublicMatchChronicle,
  getPublicMatchDetail,
  getPublicMatchEvents,
  getPublicSeasonOverview,
} from "@/lib/public-season/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
    matchId: string;
  }>;
};

export default async function PublicMatchPage({ params }: PageProps) {
  const { organizationId, seasonSlug, matchId } = await params;

  const overview = await getPublicSeasonOverview(organizationId, seasonSlug);
  if (!overview) notFound();

  const [match, events, chronicle] = await Promise.all([
    getPublicMatchDetail(organizationId, seasonSlug, matchId),
    getPublicMatchEvents(organizationId, seasonSlug, matchId),
    getPublicMatchChronicle(organizationId, seasonSlug, matchId),
  ]);

  if (!match) notFound();

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="inicio"
      formatType={overview.formatType}
    >
      <PublicMatchDetailView
        organizationId={organizationId}
        seasonSlug={seasonSlug}
        match={match}
        events={events}
        chronicle={chronicle}
      />
    </PublicSeasonShell>
  );
}
