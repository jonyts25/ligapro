"use client";

import { useActionState } from "react";
import {
  confirmMatchCalendarAction,
  resolveMatchRescheduleAction,
} from "@/lib/fixtures/actions";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import {
  initialFixtureActionState,
  type MatchRescheduleRequestRow,
} from "@/lib/fixtures/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils/cn";

type MatchRescheduleAdminPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  isProgrammed: boolean;
  calendarStatus: "programado" | "confirmado";
  rescheduleRequest: MatchRescheduleRequestRow | null;
};

function ActionMessage({
  ok,
  message,
}: {
  ok: boolean;
  message: string | null;
}) {
  if (!message) return null;
  return (
    <p
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger"
      )}
      role={ok ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

function ResolveRescheduleForm({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  request,
  resolutionAction,
  submitLabel,
  secondary = false,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  request: MatchRescheduleRequestRow;
  resolutionAction: "confirm" | "no_availability";
  submitLabel: string;
  secondary?: boolean;
}) {
  const [state, action, pending] = useActionState(
    resolveMatchRescheduleAction,
    initialFixtureActionState
  );

  return (
    <form action={action} className="space-y-2">
      <ActionMessage ok={state.ok} message={state.message} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="resolutionAction" value={resolutionAction} />
      <label
        className="block text-xs text-text-secondary"
        htmlFor={`notes-${resolutionAction}`}
      >
        Notas (opcional)
      </label>
      <input
        id={`notes-${resolutionAction}`}
        name="notes"
        type="text"
        disabled={pending}
        className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      {secondary ? (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-auto items-center justify-center rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Procesando…" : submitLabel}
        </button>
      ) : (
        <SubmitButton pending={pending} className="w-auto">
          {submitLabel}
        </SubmitButton>
      )}
    </form>
  );
}

function ConfirmCalendarForm({
  organizationId,
  competitionId,
  seasonId,
  matchId,
}: Omit<
  MatchRescheduleAdminPanelProps,
  "rescheduleRequest" | "isProgrammed" | "calendarStatus"
>) {
  const [state, action, pending] = useActionState(
    confirmMatchCalendarAction,
    initialFixtureActionState
  );

  return (
    <form action={action} className="space-y-2">
      <ActionMessage ok={state.ok} message={state.message} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="matchId" value={matchId} />
      <SubmitButton pending={pending} className="w-auto">
        Confirmar calendario
      </SubmitButton>
    </form>
  );
}

export function MatchRescheduleAdminPanel({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  isProgrammed,
  calendarStatus,
  rescheduleRequest,
}: MatchRescheduleAdminPanelProps) {
  const showConfirmCalendar =
    isProgrammed && calendarStatus === "programado";

  if (!rescheduleRequest && !showConfirmCalendar) {
    return null;
  }

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Calendario y reagendado"
        description="Resolución admin sobre propuestas de reagendado y confirmación de horario."
      />

      {rescheduleRequest?.status === "proposed" && (
        <div className="space-y-2 rounded-xl border border-border bg-surface-elevated/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label="Propuesta pendiente" variant="warning" />
            <span className="text-sm text-text-secondary">
              Esperando respuesta del rival
            </span>
          </div>
          <p className="text-sm">
            <span className="text-text-secondary">Propuesta de </span>
            <span className="font-medium">{rescheduleRequest.proposedByDisplayName}</span>
            <span className="text-text-secondary"> · </span>
            {formatMatchDateTime(rescheduleRequest.proposedStartsAt)}
            {rescheduleRequest.proposedFieldName && (
              <>
                {" · "}
                {[rescheduleRequest.proposedVenueName, rescheduleRequest.proposedFieldName]
                  .filter(Boolean)
                  .join(" · ")}
              </>
            )}
          </p>
          <p className="text-xs text-muted">
            Expira: {formatMatchDateTime(rescheduleRequest.expiresAt)}
          </p>
        </div>
      )}

      {rescheduleRequest?.status === "approved_by_opponent" && (
        <div className="space-y-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label="Aprobada por rival" variant="success" />
          </div>
          <p className="text-sm">
            <span className="text-text-secondary">Propuesta de </span>
            <span className="font-medium">{rescheduleRequest.proposedByDisplayName}</span>
            <span className="text-text-secondary"> · </span>
            {formatMatchDateTime(rescheduleRequest.proposedStartsAt)}
            {rescheduleRequest.proposedFieldName && (
              <>
                {" · "}
                {[rescheduleRequest.proposedVenueName, rescheduleRequest.proposedFieldName]
                  .filter(Boolean)
                  .join(" · ")}
              </>
            )}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ResolveRescheduleForm
              organizationId={organizationId}
              competitionId={competitionId}
              seasonId={seasonId}
              matchId={matchId}
              request={rescheduleRequest}
              resolutionAction="confirm"
              submitLabel="Confirmar reagendado"
            />
            <ResolveRescheduleForm
              organizationId={organizationId}
              competitionId={competitionId}
              seasonId={seasonId}
              matchId={matchId}
              request={rescheduleRequest}
              resolutionAction="no_availability"
              submitLabel="Sin disponibilidad"
              secondary
            />
          </div>
        </div>
      )}

      {showConfirmCalendar && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm text-text-secondary">
            Partido programado con reserva confirmada. Puedes marcarlo como
            confirmado en calendario ({calendarStatus}).
          </p>
          <ConfirmCalendarForm
            organizationId={organizationId}
            competitionId={competitionId}
            seasonId={seasonId}
            matchId={matchId}
          />
        </div>
      )}
    </Card>
  );
}
