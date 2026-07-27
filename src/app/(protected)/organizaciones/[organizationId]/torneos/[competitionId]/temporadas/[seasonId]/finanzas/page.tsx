export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  canManageActiveSeason,
  isSeasonArchived,
} from "@/lib/competitions/season-visibility";
import { getSeasonFinanceOverview } from "@/lib/finance/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { SeasonFinancePanel } from "@/components/finance/SeasonFinancePanel";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonFinancePage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

  const archived = isSeasonArchived(season.visibility);
  const canManageActive = canManageActiveSeason(season, true);

  const teams = await getSeasonFinanceOverview(organizationId, seasonId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Finanzas"
        description={`${season.name} · ${season.competitionName} · ${
          archived
            ? "Consulta histórica (solo lectura)"
            : "Ledger oficial del admin"
        }`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="finanzas"
        canManage
        canManageActive={canManageActive}
        formatType={season.format_type}
      />
      <SeasonFinancePanel
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        teams={teams}
        readOnly={archived}
      />
    </div>
  );
}
