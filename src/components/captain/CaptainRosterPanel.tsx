"use client";

import { useActionState } from "react";
import { setPlayerPaymentMarkCaptainAction } from "@/lib/captain/actions";
import type { CaptainRosterPlayer } from "@/lib/captain/types";
import { initialCaptainActionState } from "@/lib/captain/types";
import { CaptainBadge } from "@/components/teams/CaptainBadge";
import { ViceCaptainBadge } from "@/components/teams/ViceCaptainBadge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CaptainAddPlayerForm } from "@/components/captain/CaptainAddPlayerForm";
import { cn } from "@/lib/utils/cn";

type CaptainRosterPanelProps = {
  seasonTeamId: string;
  roster: CaptainRosterPlayer[];
};

function PaymentMarkRow({
  seasonTeamId,
  player,
}: {
  seasonTeamId: string;
  player: CaptainRosterPlayer;
}) {
  const [state, action, pending] = useActionState(
    setPlayerPaymentMarkCaptainAction,
    initialCaptainActionState
  );

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{player.fullName}</p>
            {player.isCaptain && <CaptainBadge />}
            {player.isViceCaptain && <ViceCaptainBadge />}
            <StatusBadge
              label={
                player.registrationStatus === "active"
                  ? "Activo"
                  : player.registrationStatus
              }
              variant={
                player.registrationStatus === "active" ? "success" : "warning"
              }
            />
          </div>
          {player.jerseyNumber != null && (
            <p className="text-sm text-text-secondary">
              Dorsal {player.jerseyNumber}
            </p>
          )}
        </div>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
          <input
            type="hidden"
            name="seasonTeamPlayerId"
            value={player.id}
          />
          <input
            type="hidden"
            name="markedPaid"
            value={player.markedPaid ? "false" : "true"}
          />
          <button
            type="submit"
            disabled={pending || player.registrationStatus !== "active"}
            className={cn(
              "inline-flex min-h-10 items-center rounded-xl border px-3 text-sm font-medium disabled:opacity-60",
              player.markedPaid
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-surface-elevated"
            )}
          >
            {pending
              ? "Guardando…"
              : player.markedPaid
                ? "Pagado"
                : "Pendiente"}
          </button>
        </form>
      </div>
      {state.message && (
        <p
          className={cn(
            "mt-2 text-xs",
            state.ok ? "text-success" : "text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </li>
  );
}

export function CaptainRosterPanel({
  seasonTeamId,
  roster,
}: CaptainRosterPanelProps) {
  const active = roster.filter((p) => p.registrationStatus === "active");

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Plantel"
        description="Lista de jugadores activos. Puedes marcar pagos de forma informal y agregar jugadores nuevos."
      />
      <p className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-text-secondary">
        Las marcas de pago son un control interno del capitán. No reemplazan ni
        afectan el cobro oficial de la liga.
      </p>
      {active.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No se pudo cargar el plantel. Si el problema persiste, contacta a tu
          liga.
        </p>
      ) : (
        <ul className="space-y-3">
          {active.map((player) => (
            <PaymentMarkRow
              key={player.id}
              seasonTeamId={seasonTeamId}
              player={player}
            />
          ))}
        </ul>
      )}
      <CaptainAddPlayerForm seasonTeamId={seasonTeamId} />
    </Card>
  );
}
