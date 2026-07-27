export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  isSeasonArchived,
  seasonDetailPath,
} from "@/lib/competitions/season-visibility";
import { getGroupsPhaseData } from "@/lib/groups/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { SeasonGroupsPanel } from "@/components/groups/SeasonGroupsPanel";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonGroupsPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();
  if (isSeasonArchived(season.visibility)) {
    redirect(seasonDetailPath(organizationId, competitionId, seasonId));
  }
  if (season.format_type !== "groups_knockout") notFound();

  const groupsData = await getGroupsPhaseData(organizationId, seasonId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Fase de grupos"
        description={`${season.name} · ${season.competitionName}`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="grupos"
        canManage
        formatType={season.format_type}
      />
      <SeasonGroupsPanel
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        data={groupsData}
      />
    </div>
  );
}
