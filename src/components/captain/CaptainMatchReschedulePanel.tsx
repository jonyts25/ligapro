"use client";

import { useActionState } from "react";
import {
  proposeMatchRescheduleCaptainAction,
  respondMatchRescheduleCaptainAction,
} from "@/lib/captain/actions";
import {
  buildCaptainWhatsAppLink,
  buildRescheduleWhatsAppMessage,
} from "@/lib/captain/whatsapp";
import type {
  CaptainMatchListItem,
  CaptainRescheduleRequest,
  CaptainTeamLink,
} from "@/lib/captain/types";
import { initialCaptainActionState } from "@/lib/captain/types";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils/cn";

type CaptainMatchReschedulePanelProps = {
  team: CaptainTeamLink;
  match: CaptainMatchListItem;
  request: CaptainRescheduleRequest | null;
  currentProfileId: string;
  opponentCaptainPhone: string | null;
};

function rescheduleStatusLabel(status: string): string {
  switch (status) {
    case "proposed":
      return "Propuesta pendiente";
    case "approved_by_opponent":
      return "Aprobada por rival";
    case "rejected_by_opponent":
      return "Rechazada por rival";
    case "expired":
      return "Expirada";
    case "confirmed_by_admin":
      return "Confirmada por la liga";
    case "no_availability":
      return "Sin disponibilidad (liga)";
    default:
      return status;
  }
}

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

function ProposeForm({
  team,
  match,
}: {
  team: CaptainTeamLink;
  match: CaptainMatchListItem;
}) {
  const [state, action, pending] = useActionState(
    proposeMatchRescheduleCaptainAction,
    initialCaptainActionState
  );

  return (
    <form action={action} className="space-y-3">
      <ActionMessage ok={state.ok} message={state.message} />
      <input type="hidden" name="seasonTeamId" value={team.seasonTeamId} />
      <input type="hidden" name="matchId" value={match.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-text-secondary">Fecha propuesta</span>
          <input
            type="date"
            name="proposedDate"
            required
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-text-secondary">Hora propuesta</span>
          <input
            type="time"
            name="proposedTime"
            required
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3"
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        La cancha actual del partido se conservará si no indicas otra. Horario
        en zona {Intl.DateTimeFormat().resolvedOptions().timeZone}.
      </p>
      <SubmitButton pending={pending} className="w-auto">
        Proponer reagendado
      </SubmitButton>
    </form>
  );
}

function RespondForm({
  team,
  match,
  request,
}: {
  team: CaptainTeamLink;
  match: CaptainMatchListItem;
  request: CaptainRescheduleRequest;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    respondMatchRescheduleCaptainAction,
    initialCaptainActionState
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    respondMatchRescheduleCaptainAction,
    initialCaptainActionState
  );

  return (
    <div className="space-y-3">
      <ActionMessage ok={approveState.ok} message={approveState.message} />
      <ActionMessage ok={rejectState.ok} message={rejectState.message} />
      <form action={approveAction} className="inline-block">
        <input type="hidden" name="seasonTeamId" value={team.seasonTeamId} />
        <input type="hidden" name="matchId" value={match.id} />
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="approve" value="true" />
        <SubmitButton pending={approvePending} className="w-auto">
          Aprobar propuesta
        </SubmitButton>
      </form>
      <form action={rejectAction} className="inline-block sm:ml-2">
        <input type="hidden" name="seasonTeamId" value={team.seasonTeamId} />
        <input type="hidden" name="matchId" value={match.id} />
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="approve" value="false" />
        <button
          type="submit"
          disabled={rejectPending}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60"
        >
          {rejectPending ? "Procesando…" : "Rechazar"}
        </button>
      </form>
    </div>
  );
}

export function CaptainMatchReschedulePanel({
  team,
  match,
  request,
  currentProfileId,
  opponentCaptainPhone,
}: CaptainMatchReschedulePanelProps) {
  const isOwnProposal =
    request?.status === "proposed" &&
    request.proposedByProfileId === currentProfileId;
  const isRivalProposal =
    request?.status === "proposed" &&
    request.proposedByProfileId !== currentProfileId;
  const isTerminal =
    request &&
    ["approved_by_opponent", "rejected_by_opponent", "expired", "confirmed_by_admin", "no_availability"].includes(
      request.status
    );

  const whatsAppMessage = request
    ? buildRescheduleWhatsAppMessage({
        teamName: team.teamName,
        opponentName: match.opponentName,
        proposedDateTimeLabel: formatMatchDateTime(request.proposedStartsAt),
        venueLabel: [request.proposedVenueName, request.proposedFieldName]
          .filter(Boolean)
          .join(" · "),
      })
    : "";
  const whatsAppHref = opponentCaptainPhone
    ? buildCaptainWhatsAppLink(opponentCaptainPhone, whatsAppMessage)
    : null;

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Reagendado"
        description="Propón o responde cambios de fecha con el rival. La liga confirma el horario final."
      />

      {!request && match.status === "scheduled" && (
        <ProposeForm team={team} match={match} />
      )}

      {request && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-elevated/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={rescheduleStatusLabel(request.status)}
              variant={
                request.status === "proposed"
                  ? "warning"
                  : request.status === "approved_by_opponent" ||
                      request.status === "confirmed_by_admin"
                    ? "success"
                    : "default"
              }
            />
          </div>
          <p className="text-sm">
            <span className="text-text-secondary">Propuesta de </span>
            <span className="font-medium">{request.proposedByDisplayName}</span>
            <span className="text-text-secondary"> · </span>
            {formatMatchDateTime(request.proposedStartsAt)}
            {request.proposedFieldName && (
              <>
                {" · "}
                {[request.proposedVenueName, request.proposedFieldName]
                  .filter(Boolean)
                  .join(" · ")}
              </>
            )}
          </p>
          {request.status === "proposed" && (
            <p className="text-xs text-muted">
              Expira: {formatMatchDateTime(request.expiresAt)}
            </p>
          )}

          {isOwnProposal && (
            <p className="text-sm text-text-secondary">
              Esperando respuesta del rival. No puedes modificar esta propuesta.
            </p>
          )}

          {isRivalProposal && (
            <RespondForm team={team} match={match} request={request} />
          )}

          {isTerminal && (
            <p className="text-sm text-text-secondary">
              Esta solicitud ya fue resuelta. Cualquier cambio final lo confirma
              la administración de la liga.
            </p>
          )}

          {request.status === "proposed" && isOwnProposal && (
            <div className="space-y-2 border-t border-border pt-3">
              {whatsAppHref ? (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white"
                >
                  Avisar por WhatsApp
                </a>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl border border-border px-4 text-sm font-medium opacity-60"
                  >
                    Avisar por WhatsApp
                  </button>
                  <p className="text-xs text-muted">
                    No hay teléfono del capitán rival en el sistema. Se requiere
                    agregar `profiles.phone` en una migración futura.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
