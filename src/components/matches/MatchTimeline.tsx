import { eventTypeLabel, type MatchTimelineEvent } from "@/lib/matches/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

function eventVariant(
  type: string
): "success" | "warning" | "danger" | "info" | "default" {
  if (type === "goal" || type === "own_goal") return "success";
  if (type === "yellow_card") return "warning";
  if (type === "red_card") return "danger";
  return "info";
}

export function MatchTimeline({ events }: { events: MatchTimelineEvent[] }) {
  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold">Línea de tiempo</h2>
      {!events.length ? (
        <EmptyState
          title="Todavía no se han registrado eventos."
          description="Los eventos aparecen aquí en orden de minuto."
        />
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex gap-3 rounded-xl border border-border px-3 py-3"
            >
              <div className="w-12 shrink-0 text-sm font-semibold text-brand">
                {event.minute}&apos;
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={eventTypeLabel(event.eventType)}
                    variant={eventVariant(event.eventType)}
                  />
                  {(event.eventType === "yellow_card" ||
                    event.eventType === "red_card") && (
                    <StatusBadge label="Disciplina" variant="warning" />
                  )}
                </div>
                <p className="text-sm text-text-primary">
                  {event.playerName}{" "}
                  <span className="text-text-secondary">· {event.teamName}</span>
                </p>
                {event.notes && (
                  <p className="text-xs text-text-secondary">{event.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted">
        La corrección o anulación segura de eventos se implementará con
        reconciliación disciplinaria en un bloque posterior.
      </p>
    </Card>
  );
}
