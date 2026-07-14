import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getMatchCaptureContext } from "@/lib/matches/queries";
import { MatchCaptureHeader } from "@/components/matches/MatchCaptureHeader";
import { CapturePermissionBadge } from "@/components/matches/CapturePermissionBadge";
import { MatchScoreForm } from "@/components/matches/MatchScoreForm";
import { MatchEventForm } from "@/components/matches/MatchEventForm";
import { MatchTimeline } from "@/components/matches/MatchTimeline";
import { MatchDisciplineSummary } from "@/components/matches/MatchDisciplineSummary";
import type { MatchStatusValue } from "@/lib/matches/types";

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

  const { details, permissions, timeline, discipline, roster, scoreMismatch } =
    ctx;
  const match = details.match;
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  const matchClosed =
    match.status === "finished" ||
    match.status === "cancelled" ||
    match.status === "walkover";

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-10">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`${base}/partidos/${matchId}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Detalle
        </Link>
        <Link
          href={`${base}/calendario`}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Calendario
        </Link>
      </div>

      <MatchCaptureHeader details={details} permissions={permissions} />
      <CapturePermissionBadge
        canCaptureEvents={permissions.canCaptureEvents}
        canUpdateResult={permissions.canUpdateResult}
      />

      {scoreMismatch && (
        <p
          className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
          role="status"
        >
          Revisa el marcador oficial: los eventos registrados no coinciden con
          el resultado.
        </p>
      )}

      <MatchScoreForm
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        matchId={matchId}
        currentStatus={match.status as MatchStatusValue}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        homeName={match.homeName}
        awayName={match.awayName}
        canUpdate={permissions.canUpdateResult}
      />

      <MatchEventForm
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        matchId={matchId}
        homeSeasonTeamId={match.homeSeasonTeamId}
        awaySeasonTeamId={match.awaySeasonTeamId}
        homeName={match.homeName}
        awayName={match.awayName}
        roster={roster}
        canCapture={permissions.canCaptureEvents}
        matchClosed={matchClosed}
      />

      <MatchTimeline events={timeline} />
      <MatchDisciplineSummary items={discipline} />
    </div>
  );
}
