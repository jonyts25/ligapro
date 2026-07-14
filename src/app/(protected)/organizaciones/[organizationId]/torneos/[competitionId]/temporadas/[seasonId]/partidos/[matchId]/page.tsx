import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getMatchSchedulingDetails } from "@/lib/fixtures/queries";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { MatchStatusBadge } from "@/components/fixtures/MatchStatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

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

  const details = await getMatchSchedulingDetails(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );
  if (!details) notFound();

  const { match } = details;
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
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
          <Link
            href={`${base}/calendario`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Calendario
          </Link>
        }
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <MatchStatusBadge match={match} />
          {match.roundNumber != null && (
            <span className="text-sm text-text-secondary">
              Jornada {match.roundNumber}
              {match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}
            </span>
          )}
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Programación</dt>
            <dd>{formatMatchDateTime(match.schedule.startsAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Sede</dt>
            <dd>{match.schedule.venueName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Cancha</dt>
            <dd>{match.schedule.fieldName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Duración slot</dt>
            <dd>{details.slotMinutes} min</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Marcador</dt>
            <dd className="text-text-secondary">
              {match.homeScore != null && match.awayScore != null
                ? `${match.homeScore} – ${match.awayScore}`
                : "Sin resultado (captura en F7+)"}
            </dd>
          </div>
        </dl>
        {inactiveInfra && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            La sede o cancha ya no está activa. La programación histórica se
            conserva; no se aceptan nuevas programaciones hacia ella.
          </p>
        )}
      </Card>

      {canManage && match.status === "scheduled" && (
        <Link
          href={`${base}/partidos/${match.id}/programar`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          {match.isProgrammed ? "Reprogramar" : "Programar"}
        </Link>
      )}
    </div>
  );
}
