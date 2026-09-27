import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import {
  fetchOrganizationMatchday,
  getMexicoCityDateString,
} from "@/lib/matches/live-matchday-queries";
import { matchStatusLabel } from "@/lib/matches/types";
import { LiveMatchdayDatePicker } from "@/components/matches/LiveMatchdayDatePicker";
import { TeamMatchupTitle } from "@/components/teams/TeamMatchupTitle";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ date?: string }>;
};

function parseDateParam(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return getMexicoCityDateString();
}

function formatSelectedDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const utcNoon = Date.UTC(year!, month! - 1, day!, 12, 0, 0);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(utcNoon));
}

export default async function LiveMatchdayPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { date: dateParam } = await searchParams;
  const user = await requireUser();
  await requireOrganizationMembership(user.id, organizationId);

  const selectedDate = parseDateParam(dateParam);
  const matches = await fetchOrganizationMatchday(
    organizationId,
    selectedDate
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <PageHeader
        title="Jornada en vivo"
        description="Partidos de la organización en el día seleccionado. Revisa alertas y abre el detalle para actuar."
      />

      <LiveMatchdayDatePicker
        organizationId={organizationId}
        selectedDate={selectedDate}
      />

      <p className="text-sm capitalize text-text-secondary">
        {formatSelectedDateLabel(selectedDate)}
      </p>

      {!matches.length ? (
        <EmptyState
          title="Sin partidos programados"
          description="No hay partidos con reserva confirmada para esta fecha en temporadas activas."
        />
      ) : (
        <ul className="space-y-3">
          {matches.map((match) => {
            const detailHref = `/organizaciones/${organizationId}/torneos/${match.competitionId}/temporadas/${match.seasonId}/partidos/${match.matchId}`;
            const venueLabel = [match.venueName, match.fieldName]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={match.matchId}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-text-secondary">
                        {formatMatchDateTime(match.startsAt)}
                        {venueLabel ? ` · ${venueLabel}` : null}
                      </p>
                      <Link href={detailHref} className="block min-w-0">
                        <TeamMatchupTitle
                          as="p"
                          homeName={match.homeTeamName}
                          awayName={match.awayTeamName}
                          homeLogoUrl={match.homeTeamLogoUrl}
                          awayLogoUrl={match.awayTeamLogoUrl}
                          homeScore={match.homeScore}
                          awayScore={match.awayScore}
                          titleClassName="text-base"
                        />
                      </Link>
                      <p className="text-sm text-text-secondary">
                        {match.competitionName} · {match.seasonName}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {matchStatusLabel(match.status)}
                      </p>
                    </div>
                    <Link
                      href={detailHref}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border px-4 text-sm font-medium"
                    >
                      Ver partido
                    </Link>
                  </div>

                  {match.alerts.length ? (
                    <ul className="flex flex-wrap gap-2" role="list">
                      {match.alerts.map((alert) => (
                        <li
                          key={alert.id}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold",
                            alert.id === "open_dispute"
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : "border-warning/40 bg-warning/10 text-warning"
                          )}
                        >
                          {alert.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
