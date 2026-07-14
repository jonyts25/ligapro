import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import {
  getMatchCaptureContext,
  getOrganizationMemberOptions,
} from "@/lib/matches/queries";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { MatchStatusBadge } from "@/components/fixtures/MatchStatusBadge";
import { MatchOfficialsManager } from "@/components/matches/MatchOfficialsManager";
import { MatchTimeline } from "@/components/matches/MatchTimeline";
import { MatchDisciplineSummary } from "@/components/matches/MatchDisciplineSummary";
import { CapturePermissionBadge } from "@/components/matches/CapturePermissionBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { matchStatusLabel } from "@/lib/matches/types";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
    matchId: string;
  }>;
};

export default async function MatchDetailPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId, matchId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const ctx = await getMatchCaptureContext(
    organizationId,
    competitionId,
    seasonId,
    matchId,
    user.id,
    membership.role
  );
  if (!ctx) notFound();

  const { details, permissions, timeline, discipline, officials, scoreMismatch } =
    ctx;
  const match = details.match;
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  const members = canManage
    ? await getOrganizationMemberOptions(organizationId)
    : [];

  const inactiveInfra =
    match.isProgrammed &&
    (match.schedule.fieldIsActive === false ||
      match.schedule.venueIsActive === false);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`${match.homeName} vs ${match.awayName}`}
        description={`${details.seasonName} · ${details.competitionName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${base}/calendario`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
            >
              Calendario
            </Link>
            {(permissions.canCaptureEvents || permissions.canUpdateResult) && (
              <Link
                href={`${base}/partidos/${match.id}/captura`}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Capturar
              </Link>
            )}
          </div>
        }
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <MatchStatusBadge match={match} />
          <span className="text-sm text-text-secondary">
            {matchStatusLabel(match.status)}
            {match.homeScore != null && match.awayScore != null
              ? ` · ${match.homeScore}–${match.awayScore}`
              : ""}
          </span>
        </div>
        <CapturePermissionBadge
          canCaptureEvents={permissions.canCaptureEvents}
          canUpdateResult={permissions.canUpdateResult}
        />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Jornada</dt>
            <dd>
              {match.roundNumber != null
                ? `${match.roundNumber}${match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Programación</dt>
            <dd>{formatMatchDateTime(match.schedule.startsAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Sede / cancha</dt>
            <dd>
              {[match.schedule.venueName, match.schedule.fieldName]
                .filter(Boolean)
                .join(" · ") || "—"}
            </dd>
          </div>
        </dl>
        {scoreMismatch && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            Revisa el marcador oficial: los eventos registrados no coinciden con
            el resultado.
          </p>
        )}
        {inactiveInfra && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            La sede o cancha ya no está activa. La programación histórica se
            conserva.
          </p>
        )}
      </Card>

      {canManage && match.status === "scheduled" && (
        <Link
          href={`${base}/partidos/${match.id}/programar`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          {match.isProgrammed ? "Reprogramar" : "Programar"}
        </Link>
      )}

      <MatchOfficialsManager
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        matchId={matchId}
        matchStatus={match.status}
        members={members}
        officials={officials}
        canManage={canManage}
      />

      <MatchTimeline events={timeline} />
      <MatchDisciplineSummary items={discipline} />
    </div>
  );
}
