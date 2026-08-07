import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import type {
  PublicMatchDetail,
  PublicMatchEventRow,
  PublicMatchChronicle,
} from "@/lib/public-season/types";

type PublicMatchDetailViewProps = {
  organizationId: string;
  seasonSlug: string;
  match: PublicMatchDetail;
  events: PublicMatchEventRow[];
  chronicle: PublicMatchChronicle | null;
};

function eventLabel(eventType: string): string {
  switch (eventType) {
    case "goal":
      return "Gol";
    case "own_goal":
      return "Autogol";
    case "yellow_card":
      return "Amarilla";
    case "red_card":
      return "Roja";
    default:
      return eventType;
  }
}

export function PublicMatchDetailView({
  organizationId,
  seasonSlug,
  match,
  events,
  chronicle,
}: PublicMatchDetailViewProps) {
  const base = `/publico/${organizationId}/${seasonSlug}`;
  const goalEvents = events.filter(
    (event) => event.eventType === "goal" || event.eventType === "own_goal"
  );

  return (
    <div className="space-y-6">
      <Link
        href={base}
        className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
      >
        ← Volver al inicio
      </Link>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">
            {match.homeTeamName}{" "}
            {match.homeScore != null && match.awayScore != null ? (
              <span className="font-normal text-muted">
                {match.homeScore}–{match.awayScore}
              </span>
            ) : null}{" "}
            {match.awayTeamName}
          </h1>
          {(match.status === "finished" || match.status === "walkover") && (
            <StatusBadge label="Finalizado" variant="finished" />
          )}
        </div>
        <p className="text-sm text-text-secondary">
          {match.roundLabel ??
            (match.roundNumber ? `Jornada ${match.roundNumber}` : "Partido")}
          {match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}
          {match.startsAt ? ` · ${formatMatchDateTime(match.startsAt)}` : ""}
        </p>
        {(match.venueName || match.fieldName) && (
          <p className="text-sm text-text-secondary">
            {[match.venueName, match.fieldName].filter(Boolean).join(" · ")}
          </p>
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">
          Goleadores del partido
        </h2>
        {goalEvents.length === 0 ? (
          <EmptyState
            title="Sin goles registrados"
            description="No hay goles activos capturados para este partido."
          />
        ) : (
          <ul className="space-y-2">
            {goalEvents.map((event, index) => (
              <li
                key={`${event.minute}-${event.playerName}-${index}`}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="font-medium text-text-primary">
                  Min {event.minute}: {event.playerName}
                </span>
                <span className="text-text-secondary">
                  {" "}
                  · {eventLabel(event.eventType)} · {event.teamName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {events.some(
        (event) =>
          event.eventType === "yellow_card" || event.eventType === "red_card"
      ) && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text-primary">
            Tarjetas
          </h2>
          <ul className="space-y-2">
            {events
              .filter(
                (event) =>
                  event.eventType === "yellow_card" ||
                  event.eventType === "red_card"
              )
              .map((event, index) => (
                <li
                  key={`card-${event.minute}-${index}`}
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  Min {event.minute}: {eventLabel(event.eventType)} a{" "}
                  {event.playerName} ({event.teamName})
                </li>
              ))}
          </ul>
        </section>
      )}

      {chronicle && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text-primary">
            Crónica
          </h2>
          <Card className="space-y-2">
            <p className="text-xs text-text-secondary">
              {new Date(chronicle.generatedAt).toLocaleString("es-MX")}
            </p>
            <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
              {chronicle.content}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
