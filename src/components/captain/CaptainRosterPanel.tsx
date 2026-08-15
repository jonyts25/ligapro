"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  setPlayerPaymentMarkCaptainAction,
  updateOwnRosterJerseyAction,
} from "@/lib/captain/actions";
import type { CaptainRosterPlayer } from "@/lib/captain/types";
import { initialCaptainActionState } from "@/lib/captain/types";
import { CaptainBadge } from "@/components/teams/CaptainBadge";
import { ViceCaptainBadge } from "@/components/teams/ViceCaptainBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PlayerVerificationBadge } from "@/components/players/PlayerVerificationBadge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { CaptainAddPlayerForm } from "@/components/captain/CaptainAddPlayerForm";
import { cn } from "@/lib/utils/cn";

type CaptainRosterPanelProps = {
  seasonTeamId: string;
  roster: CaptainRosterPlayer[];
  requirePlayerVerification: boolean;
  rosterLockedByCaptain: boolean;
};

function JerseyEditor({
  seasonTeamId,
  player,
  rosterLockedByCaptain,
}: {
  seasonTeamId: string;
  player: CaptainRosterPlayer;
  rosterLockedByCaptain: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateOwnRosterJerseyAction,
    initialCaptainActionState
  );
  const [editing, setEditing] = useState(false);

  if (rosterLockedByCaptain) {
    return player.jerseyNumber != null ? (
      <p className="text-sm text-text-secondary">Dorsal {player.jerseyNumber}</p>
    ) : (
      <p className="text-sm text-muted">Sin dorsal</p>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left text-sm font-medium text-brand hover:underline"
      >
        {player.jerseyNumber != null
          ? `Dorsal ${player.jerseyNumber} · Editar`
          : "Asignar dorsal"}
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
      <input type="hidden" name="seasonTeamPlayerId" value={player.id} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="jerseyNumber"
          type="number"
          min={1}
          defaultValue={player.jerseyNumber ?? ""}
          placeholder="Dorsal"
          disabled={pending}
          className="h-10 w-24 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <SubmitButton pending={pending} className="h-10 w-auto px-3 text-sm">
          Guardar
        </SubmitButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-text-secondary"
        >
          Cancelar
        </button>
      </div>
      {state.message && (
        <p
          className={cn("text-xs", state.ok ? "text-success" : "text-danger")}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

function PaymentMarkRow({
  seasonTeamId,
  player,
  requirePlayerVerification,
  rosterLockedByCaptain,
}: {
  seasonTeamId: string;
  player: CaptainRosterPlayer;
  requirePlayerVerification: boolean;
  rosterLockedByCaptain: boolean;
}) {
  const [state, action, pending] = useActionState(
    setPlayerPaymentMarkCaptainAction,
    initialCaptainActionState
  );

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <PlayerAvatar
            photoUrl={player.photoUrl}
            name={player.fullName}
            size="sm"
          />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{player.fullName}</p>
              {player.isCaptain && <CaptainBadge />}
              {player.isViceCaptain && <ViceCaptainBadge />}
              <PlayerVerificationBadge
                status={player.verificationStatus}
                visible={requirePlayerVerification}
              />
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
            <JerseyEditor
              seasonTeamId={seasonTeamId}
              player={player}
              rosterLockedByCaptain={rosterLockedByCaptain}
            />
            <Link
              href={`/mi-equipo/${seasonTeamId}/jugadores/${player.id}/credencial`}
              className="inline-flex text-sm font-medium text-accent"
            >
              Ver credencial
            </Link>
          </div>
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
  requirePlayerVerification,
  rosterLockedByCaptain,
}: CaptainRosterPanelProps) {
  const active = roster.filter((p) => p.registrationStatus === "active");

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Plantel"
        description="Lista de jugadores activos. Puedes marcar pagos de forma informal y agregar jugadores nuevos."
      />
      {rosterLockedByCaptain && (
        <p
          className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-text-secondary"
          title="El plantel está bloqueado. Contacta al administrador para cualquier cambio."
        >
          El plantel está bloqueado. Contacta al administrador para cualquier
          cambio (dorsales y altas).
        </p>
      )}
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
              requirePlayerVerification={requirePlayerVerification}
              rosterLockedByCaptain={rosterLockedByCaptain}
            />
          ))}
        </ul>
      )}
      {!rosterLockedByCaptain && (
        <CaptainAddPlayerForm seasonTeamId={seasonTeamId} />
      )}
    </Card>
  );
}
