import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getMatchStatsCaptureContext } from "@/lib/match-stats/queries";
import { MatchStatsCaptureForm } from "@/components/matches/MatchStatsCaptureForm";
import { MatchCaptureHeader } from "@/components/matches/MatchCaptureHeader";
import { getMatchCaptureContext } from "@/lib/matches/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
    matchId: string;
  }>;
};

export default async function MatchStatsCapturePage({ params }: PageProps) {
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

  const stats = await getMatchStatsCaptureContext(
    organizationId,
    competitionId,
    seasonId,
    matchId,
    user.id,
    membership.role
  );
  if (!stats) notFound();

  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-10">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`${base}/partidos/${matchId}/captura`}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Captura en vivo
        </Link>
        <Link
          href={`${base}/partidos/${matchId}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Detalle
        </Link>
      </div>

      <MatchCaptureHeader
        details={ctx.details}
        permissions={ctx.permissions}
      />

      <MatchStatsCaptureForm
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        matchId={matchId}
        data={{
          home: stats.home,
          away: stats.away,
          context: stats.context,
          canEdit: stats.canEdit,
        }}
      />
    </div>
  );
}
