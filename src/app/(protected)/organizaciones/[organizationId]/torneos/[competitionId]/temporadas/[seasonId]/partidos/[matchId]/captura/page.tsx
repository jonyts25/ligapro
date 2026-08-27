import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getMatchCaptureContext } from "@/lib/matches/queries";
import { MatchCaptureWithDemoView } from "@/components/demo-view/MatchCaptureWithDemoView";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
    matchId: string;
  }>;
};

export default async function MatchCapturePage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId, matchId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );

  const ctx = await getMatchCaptureContext(
    organizationId,
    competitionId,
    seasonId,
    matchId,
    user.id,
    membership.role
  );
  if (!ctx) notFound();

  const { details, permissions, timeline, discipline, roster, scoreMismatch, requirePlayerVerification } =
    ctx;
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-10">
      <MatchCaptureWithDemoView
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        matchId={matchId}
        base={base}
        details={details}
        realPermissions={permissions}
        timeline={timeline}
        discipline={discipline}
        roster={roster}
        scoreMismatch={scoreMismatch}
        requirePlayerVerification={requirePlayerVerification}
      />
    </div>
  );
}
