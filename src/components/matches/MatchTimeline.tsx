"use client";

import { useActionState, useState } from "react";
import { voidMatchEventAction } from "@/lib/matches/actions";
import { captureErrorAlertClass } from "@/lib/matches/capture-errors";
import {
  eventTypeLabel,
  initialCaptureActionState,
  type MatchTimelineEvent,
} from "@/lib/matches/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils/cn";

type MatchTimelineProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  events: MatchTimelineEvent[];
  canVoidEvents: boolean;
};

function eventVariant(
  type: string
): "success" | "warning" | "danger" | "info" | "default" {
  if (type === "goal" || type === "own_goal") return "success";
  if (type === "yellow_card") return "warning";
  if (type === "red_card") return "danger";
  return "info";
}

function VoidEventForm({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  eventId,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  eventId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    voidMatchEventAction,
    initialCaptureActionState
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center rounded-xl border border-danger/40 px-3 text-xs font-medium text-danger hover:bg-danger/10"
      >
        Anular
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2 border-t border-border pt-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="eventId" value={eventId} />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-text-secondary">
          Motivo de anulación
        </span>
        <textarea
          name="reason"
          required
          rows={2}
          maxLength={500}
          disabled={pending}
          className="min-h-16 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Describe el error de captura…"
        />
      </label>
      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-xs",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : captureErrorAlertClass(state.errorKind ?? "generic")
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending} className="w-auto min-h-9 text-xs">
          Confirmar anulación
        </SubmitButton>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="inline-flex min-h-9 items-center rounded-xl border border-border px-3 text-xs font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function MatchTimeline({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  events,
  canVoidEvents,
}: MatchTimelineProps) {
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
          {events.map((event) => {
            const voided = Boolean(event.voidedAt);
            return (
              <li
                key={event.id}
                className={cn(
                  "flex gap-3 rounded-xl border px-3 py-3",
                  voided
                    ? "border-border/60 bg-surface/40 opacity-75"
                    : "border-border"
                )}
              >
                <div
                  className={cn(
                    "w-12 shrink-0 text-sm font-semibold",
                    voided ? "text-muted line-through" : "text-brand"
                  )}
                >
                  {event.minute}&apos;
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={eventTypeLabel(event.eventType)}
                      variant={voided ? "default" : eventVariant(event.eventType)}
                    />
                    {voided && (
                      <StatusBadge label="Anulado" variant="warning" />
                    )}
                    {!voided &&
                      (event.eventType === "yellow_card" ||
                        event.eventType === "red_card") && (
                        <StatusBadge label="Disciplina" variant="warning" />
                      )}
                  </div>
                  <p
                    className={cn(
                      "text-sm text-text-primary",
                      voided && "line-through"
                    )}
                  >
                    {event.playerName}{" "}
                    <span className="text-text-secondary">
                      · {event.teamName}
                    </span>
                  </p>
                  {event.notes && (
                    <p
                      className={cn(
                        "text-xs text-text-secondary",
                        voided && "line-through"
                      )}
                    >
                      {event.notes}
                    </p>
                  )}
                  {voided && event.voidReason && (
                    <p className="text-xs text-warning" role="status">
                      Motivo: {event.voidReason}
                    </p>
                  )}
                  {canVoidEvents && !voided && (
                    <VoidEventForm
                      organizationId={organizationId}
                      competitionId={competitionId}
                      seasonId={seasonId}
                      matchId={matchId}
                      eventId={event.id}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {canVoidEvents && (
        <p className="text-xs text-muted">
          La anulación conserva el registro original y excluye el evento de
          goleo y disciplina. No revierte suspensiones automáticamente.
        </p>
      )}
    </Card>
  );
}
