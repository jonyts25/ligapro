import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import {
  getActiveVenuesAndFields,
  getMatchSchedulingDetails,
} from "@/lib/fixtures/queries";
import { MatchSchedulingForm } from "@/components/fixtures/MatchSchedulingForm";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
    matchId: string;
  }>;
};

export default async function ScheduleMatchPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId, matchId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const [details, venuesFields] = await Promise.all([
    getMatchSchedulingDetails(
      organizationId,
      competitionId,
      seasonId,
      matchId
    ),
    getActiveVenuesAndFields(organizationId),
  ]);
  if (!details) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={
          details.match.isProgrammed
            ? "Reprogramar partido"
            : "Programar partido"
        }
        description={`${details.match.homeName} vs ${details.match.awayName}`}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/partidos/${matchId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Volver
          </Link>
        }
      />
      <MatchSchedulingForm
        details={details}
        venues={venuesFields.venues}
        fields={venuesFields.fields}
        organizationId={organizationId}
        canManage={canManage}
      />
    </div>
  );
}
