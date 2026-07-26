"use client";

import { useActionState, useState } from "react";
import { reviewPlayerVerificationAction } from "@/lib/verification/actions";
import { captureErrorAlertClass } from "@/lib/matches/capture-errors";
import { initialCaptureActionState } from "@/lib/matches/types";
import type { PendingVerificationPlayer } from "@/lib/verification/queries";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type VerificationReviewPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  pendingPlayers: PendingVerificationPlayer[];
};

function ReviewRow({
  organizationId,
  competitionId,
  seasonId,
  player,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  player: PendingVerificationPlayer;
}) {
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [state, action, pending] = useActionState(
    reviewPlayerVerificationAction,
    initialCaptureActionState
  );

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{player.fullName}</p>
          <p className="text-sm text-text-secondary">
            {player.teamName}
            {player.jerseyNumber != null ? ` · Dorsal ${player.jerseyNumber}` : ""}
          </p>
        </div>
        {mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <form action={action}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="competitionId" value={competitionId} />
              <input type="hidden" name="seasonId" value={seasonId} />
              <input type="hidden" name="playerId" value={player.playerId} />
              <input type="hidden" name="decision" value="approve" />
              <SubmitButton pending={pending} className="w-auto min-h-10">
                Aprobar
              </SubmitButton>
            </form>
            <button
              type="button"
              onClick={() => setMode("reject")}
              className="inline-flex min-h-10 items-center rounded-xl border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger/10"
            >
              Rechazar
            </button>
          </div>
        )}
      </div>

      {mode === "reject" && (
        <form action={action} className="mt-3 space-y-3 border-t border-border pt-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="playerId" value={player.playerId} />
          <input type="hidden" name="decision" value="reject" />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Motivo del rechazo</span>
            <textarea
              name="reason"
              required
              rows={2}
              maxLength={500}
              disabled={pending}
              className="min-h-16 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pending={pending} className="w-auto">
              Confirmar rechazo
            </SubmitButton>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("idle")}
              className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {state.message && (
        <p
          className={cn(
            "mt-2 rounded-xl border px-3 py-2 text-xs",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : captureErrorAlertClass(state.errorKind ?? "generic")
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </li>
  );
}

export function VerificationReviewPanel({
  organizationId,
  competitionId,
  seasonId,
  pendingPlayers,
}: VerificationReviewPanelProps) {
  if (pendingPlayers.length === 0) {
    return (
      <Card>
        <SectionHeader
          title="Verificación de identidad"
          description="No hay solicitudes pendientes en esta temporada."
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Verificación de identidad pendiente"
        description="Revisa solicitudes de jugadores antes de activarlos en plantel cuando la temporada lo exige."
      />
      <ul className="space-y-3">
        {pendingPlayers.map((player) => (
          <ReviewRow
            key={player.playerId}
            organizationId={organizationId}
            competitionId={competitionId}
            seasonId={seasonId}
            player={player}
          />
        ))}
      </ul>
    </Card>
  );
}
