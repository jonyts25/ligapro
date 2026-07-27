export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { canManageActiveSeason } from "@/lib/competitions/season-visibility";
import {
  getEligibleTeamCount,
  getKnockoutBracketData,
} from "@/lib/knockout/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { KnockoutBracketAdminPanel } from "@/components/knockout/KnockoutBracketAdminPanel";
import { KnockoutBracketView } from "@/components/knockout/KnockoutBracketView";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonBracketPage({ params }: PageProps) {
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

  const canManageActive = canManageActiveSeason(season, canManage);

  const formatType = season.format_type;
  if (formatType !== "knockout" && formatType !== "groups_knockout") {
    notFound();
  }

  const [bracketData, eligibleCount] = await Promise.all([
    getKnockoutBracketData(organizationId, seasonId),
    getEligibleTeamCount(organizationId, seasonId),
  ]);

  const data = bracketData ?? {
    rounds: [],
    championSeasonTeamId: null,
    championTeamName: null,
    teamNames: {},
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Eliminatoria"
        description={`${season.name} · ${season.competitionName}`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="bracket"
        canManage={canManage}
        canManageActive={canManageActive}
        formatType={formatType}
      />

      {canManageActive ? (
        <KnockoutBracketAdminPanel
          organizationId={organizationId}
          competitionId={competitionId}
          seasonId={seasonId}
          data={data}
          eligibleTeamCount={eligibleCount}
          formatType={formatType}
        />
      ) : (
        <KnockoutBracketView data={data} />
      )}
    </div>
  );
}
