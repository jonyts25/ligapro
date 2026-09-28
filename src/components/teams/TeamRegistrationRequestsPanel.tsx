"use client";

import { useActionState, useState } from "react";
import {
  approveTeamRegistrationRequestAction,
  rejectTeamRegistrationRequestAction,
} from "@/lib/teams/registration-requests-actions";
import { initialTeamsActionState } from "@/lib/teams/types";
import type { TeamRegistrationRequestRow } from "@/lib/teams/registration-requests";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";

type TeamRegistrationRequestsPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  requests: TeamRegistrationRequestRow[];
};

function ApproveRequestButton({
  organizationId,
  competitionId,
  seasonId,
  requestId,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(
    approveTeamRegistrationRequestAction,
    initialTeamsActionState
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton
        pending={pending}
        className="w-auto px-3 py-2 text-sm"
      >
        Aprobar
      </SubmitButton>
      {state.message && (
        <span className="sr-only" role={state.ok ? "status" : "alert"}>
          {state.message}
        </span>
      )}
    </form>
  );
}

function RejectRequestForm({
  organizationId,
  competitionId,
  seasonId,
  requestId,
  onCancel,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  requestId: string;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    rejectTeamRegistrationRequestAction,
    initialTeamsActionState
  );

  if (state.ok) {
    return null;
  }

  return (
    <form action={action} className="mt-3 space-y-2 rounded-xl border border-border p-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor={`reason-${requestId}`} className="block text-sm font-medium">
        Motivo del rechazo
      </label>
      <textarea
        id={`reason-${requestId}`}
        name="reason"
        required
        rows={2}
        disabled={pending}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />
      {state.fieldErrors?.reason && (
        <p className="text-xs text-danger">{state.fieldErrors.reason}</p>
      )}
      {state.message && !state.ok && (
        <p className="text-xs text-danger">{state.message}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending} className="w-auto px-3 py-2 text-sm">
          Confirmar rechazo
        </SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center px-3 text-sm text-text-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function RequestRow({
  organizationId,
  competitionId,
  seasonId,
  request,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  request: TeamRegistrationRequestRow;
}) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-text-primary">{request.team_name}</p>
          <p className="text-sm text-text-secondary">
            {request.contact_name} · {request.contact_email}
          </p>
          {request.contact_phone && (
            <p className="text-sm text-muted">{request.contact_phone}</p>
          )}
          {request.requested_group_name && (
            <p className="text-sm text-muted">
              Grupo deseado: {request.requested_group_name}
            </p>
          )}
          <p className="text-xs text-muted">
            Recibida{" "}
            {new Date(request.created_at).toLocaleString("es-MX", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Mexico_City",
            })}
          </p>
        </div>
        {!rejecting && (
          <div className="flex flex-wrap gap-2">
            <ApproveRequestButton
              organizationId={organizationId}
              competitionId={competitionId}
              seasonId={seasonId}
              requestId={request.id}
            />
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="inline-flex min-h-11 items-center rounded-xl border border-danger/40 px-3 text-sm font-medium text-danger"
            >
              Rechazar
            </button>
          </div>
        )}
      </div>
      {rejecting && (
        <RejectRequestForm
          organizationId={organizationId}
          competitionId={competitionId}
          seasonId={seasonId}
          requestId={request.id}
          onCancel={() => setRejecting(false)}
        />
      )}
    </li>
  );
}

export function TeamRegistrationRequestsPanel({
  organizationId,
  competitionId,
  seasonId,
  requests,
}: TeamRegistrationRequestsPanelProps) {
  if (requests.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          No hay solicitudes pendientes de inscripción.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <RequestRow
          key={request.id}
          organizationId={organizationId}
          competitionId={competitionId}
          seasonId={seasonId}
          request={request}
        />
      ))}
    </ul>
  );
}
