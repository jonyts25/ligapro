export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  getActiveOrganizationFields,
  getSeasonFieldBlocks,
} from "@/lib/season-fields/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonStandingsNav } from "@/components/standings/SeasonStandingsNav";
import { SeasonFieldBlocksEditor } from "@/components/season-fields/SeasonFieldBlocksEditor";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonFieldBlocksPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

  const [fields, blocks] = await Promise.all([
    getActiveOrganizationFields(organizationId),
    getSeasonFieldBlocks(organizationId, seasonId),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Canchas del torneo"
        description={`${season.name} · Bloqueos semanales a favor de esta temporada`}
      />
      <SeasonStandingsNav
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        active="canchas"
        canManage
      />
      <SeasonFieldBlocksEditor
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        fields={fields}
        initialBlocks={blocks}
      />
    </div>
  );
}
