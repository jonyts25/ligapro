"use client";

import Link from "next/link";
import { MatchCaptureHeader } from "@/components/matches/MatchCaptureHeader";
import { CapturePermissionBadge } from "@/components/matches/CapturePermissionBadge";
import { CaptureWindowStatus } from "@/components/matches/CaptureWindowStatus";
import { MatchScoreForm } from "@/components/matches/MatchScoreForm";
import { MatchEventForm } from "@/components/matches/MatchEventForm";
import { MatchTimeline } from "@/components/matches/MatchTimeline";
import { MatchDisciplineSummary } from "@/components/matches/MatchDisciplineSummary";
import { MatchRosterCredentials } from "@/components/matches/MatchRosterCredentials";
import { useDemoMatchCapturePermissions } from "@/components/demo-view/useDemoMatchCapturePermissions";
import type { MatchSchedulingDetails } from "@/lib/fixtures/types";
import type {
  MatchCapturePermissions,
  MatchDisciplineItem,
  MatchRosterPlayer,
  MatchStatusValue,
  MatchTimelineEvent,
} from "@/lib/matches/types";

type MatchCaptureWithDemoViewProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  base: string;
  details: MatchSchedulingDetails;
  realPermissions: MatchCapturePermissions;
  timeline: MatchTimelineEvent[];
  discipline: MatchDisciplineItem[];
  roster: MatchRosterPlayer[];
  scoreMismatch: boolean;
  requirePlayerVerification: boolean;
};

export function MatchCaptureWithDemoView({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  base,
  details,
  realPermissions,
  timeline,
  discipline,
  roster,
  scoreMismatch,
  requirePlayerVerification,
}: MatchCaptureWithDemoViewProps) {
  const match = details.match;
  const permissions = useDemoMatchCapturePermissions(
    realPermissions,
    match.status as MatchStatusValue
  );
  const matchClosed =
    match.status === "finished" ||
    match.status === "cancelled" ||
    match.status === "walkover";

  return (
    <>
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
        <Link
          href={`${base}/partidos/${matchId}/captura/estadisticas`}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Estadísticas
        </Link>
      </div>

      <MatchCaptureHeader details={details} permissions={permissions} />
      <CapturePermissionBadge
        canCaptureEvents={permissions.canCaptureEvents}
        canUpdateResult={permissions.canUpdateResult}
      />
      <CaptureWindowStatus
        canCaptureEvents={permissions.canCaptureEvents}
        captureWindowOpen={permissions.captureWindowOpen}
        captureWindowBypass={permissions.captureWindowBypass}
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
        closeOnlyResultUpdate={permissions.closeOnlyResultUpdate}
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
        matchStartsAt={match.schedule.startsAt}
      />

      <MatchRosterCredentials
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        matchId={matchId}
        homeName={match.homeName}
        awayName={match.awayName}
        homeSeasonTeamId={match.homeSeasonTeamId}
        awaySeasonTeamId={match.awaySeasonTeamId}
        roster={roster}
        requirePlayerVerification={requirePlayerVerification}
      />

      <MatchTimeline
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        matchId={matchId}
        events={timeline}
        canVoidEvents={permissions.canVoidEvents}
      />
      <MatchDisciplineSummary items={discipline} />
    </>
  );
}
