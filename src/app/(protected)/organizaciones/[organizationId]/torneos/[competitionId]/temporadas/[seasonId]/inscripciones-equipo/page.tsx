import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  isSeasonArchived,
  seasonDetailPath,
} from "@/lib/competitions/season-visibility";
import { getPendingTeamRegistrationRequests } from "@/lib/teams/registration-requests";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamRegistrationRequestsPanel } from "@/components/teams/TeamRegistrationRequestsPanel";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function TeamRegistrationRequestsPage({ params }: PageProps) {
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

  const requests = await getPendingTeamRegistrationRequests(
    organizationId,
    seasonId
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Solicitudes de inscripción"
        description={`${season.competitionName} · ${season.name}`}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <TeamRegistrationRequestsPanel
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        requests={requests}
      />
    </div>
  );
}
