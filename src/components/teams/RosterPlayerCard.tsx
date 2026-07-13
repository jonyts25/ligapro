"use client";

import { useActionState, useState } from "react";
import {
  deactivateRosterPlayerAction,
  setCaptainAction,
} from "@/lib/teams/actions";
import { CaptainBadge } from "@/components/teams/CaptainBadge";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  initialTeamsActionState,
  rosterStatusLabel,
  type RosterListItem,
} from "@/lib/teams/types";
import { cn } from "@/lib/utils/cn";

type RosterPlayerCardProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  player: RosterListItem;
  canManage: boolean;
  hasCaptain: boolean;
};

function rosterStatusVariant(
  status: string
): "default" | "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "suspended") return "danger";
  return "warning";
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
      className={`rounded-xl border px-3 py-2 text-xs ${
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
      role={ok ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

export function RosterPlayerCard({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  player,
  canManage,
  hasCaptain,
}: RosterPlayerCardProps) {
  const [captainState, captainAction, captainPending] = useActionState(
    setCaptainAction,
    initialTeamsActionState
  );
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateRosterPlayerAction,
    initialTeamsActionState
  );
  const [confirmReplace, setConfirmReplace] = useState(false);

  const showCaptainForm =
    canManage &&
    !player.is_captain &&
    player.registration_status === "active";
  const showDeactivateForm =
    canManage && player.registration_status === "active";
  const requiresConfirm = hasCaptain && !player.is_captain;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text-primary">
              {player.full_name}
            </h3>
            {player.is_captain && <CaptainBadge />}
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            {player.jersey_number != null
              ? `Dorsal ${player.jersey_number}`
              : "Sin dorsal"}
          </p>
        </div>
        <StatusBadge
          label={rosterStatusLabel(player.registration_status)}
          variant={rosterStatusVariant(player.registration_status)}
        />
      </div>

      {showCaptainForm && (
        <div className="space-y-3 border-t border-border pt-4">
          <ActionMessage
            ok={captainState.ok}
            message={captainState.message}
          />
          <form action={captainAction} className="space-y-3">
            <input
              type="hidden"
              name="organizationId"
              value={organizationId}
            />
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="seasonId" value={seasonId} />
            <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
            <input type="hidden" name="playerId" value={player.player_id} />
            {requiresConfirm && (
              <label className="flex items-start gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  disabled={captainPending}
                  className="mt-0.5 min-h-4 min-w-4"
                />
                Confirmo reemplazar capitán
              </label>
            )}
            <SubmitButton
              pending={captainPending}
              className="w-auto"
              disabled={requiresConfirm && !confirmReplace}
            >
              Asignar capitán
            </SubmitButton>
          </form>
        </div>
      )}

      {showDeactivateForm && (
        <div className="space-y-3 border-t border-border pt-4">
          <ActionMessage
            ok={deactivateState.ok}
            message={deactivateState.message}
          />
          <form action={deactivateAction}>
            <input
              type="hidden"
              name="organizationId"
              value={organizationId}
            />
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="seasonId" value={seasonId} />
            <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
            <input type="hidden" name="rosterId" value={player.id} />
            <button
              type="submit"
              disabled={deactivatePending}
              className={cn(
                "inline-flex min-h-11 items-center rounded-xl border border-danger/40 px-4 text-sm font-medium text-danger",
                "hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {deactivatePending ? "Procesando…" : "Retirar del plantel"}
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}
