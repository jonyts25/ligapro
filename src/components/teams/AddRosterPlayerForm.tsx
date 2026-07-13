"use client";

import { useActionState } from "react";
import {
  addExistingPlayerAction,
  createPlayerAndAddAction,
} from "@/lib/teams/actions";
import {
  initialTeamsActionState,
  type PlayerRecord,
} from "@/lib/teams/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type AddRosterPlayerFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  availablePlayers: PlayerRecord[];
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-danger" role="alert">
      {message}
    </p>
  );
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
      className={`rounded-xl border px-3 py-2 text-sm ${
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

export function AddRosterPlayerForm({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  availablePlayers,
}: AddRosterPlayerFormProps) {
  const [createState, createAction, createPending] = useActionState(
    createPlayerAndAddAction,
    initialTeamsActionState
  );
  const [existingState, existingAction, existingPending] = useActionState(
    addExistingPlayerAction,
    initialTeamsActionState
  );

  const createValues = createState.values;
  const existingValues = existingState.values;

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <SectionHeader
          title="Crear jugador nuevo"
          description="Registra un jugador en la organización y agrégalo al plantel."
        />
        <ActionMessage ok={createState.ok} message={createState.message} />
        <form action={createAction} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="seasonTeamId" value={seasonTeamId} />

          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-sm font-medium">
              Nombre completo
            </label>
            <input
              id="fullName"
              name="fullName"
              required
              minLength={2}
              maxLength={100}
              disabled={createPending}
              defaultValue={String(createValues?.fullName ?? "")}
              placeholder="Juan Pérez García"
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                createState.fieldErrors?.fullName && "border-danger"
              )}
            />
            <FieldError message={createState.fieldErrors?.fullName} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="createJerseyNumber" className="block text-sm font-medium">
              Dorsal{" "}
              <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="createJerseyNumber"
              name="jerseyNumber"
              inputMode="numeric"
              disabled={createPending}
              defaultValue={String(createValues?.jerseyNumber ?? "")}
              placeholder="10"
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                createState.fieldErrors?.jerseyNumber && "border-danger"
              )}
            />
            <FieldError message={createState.fieldErrors?.jerseyNumber} />
          </div>

          <SubmitButton pending={createPending} className="w-auto">
            Crear y agregar
          </SubmitButton>
        </form>
      </Card>

      <Card className="space-y-4">
        <SectionHeader
          title="Agregar jugador existente"
          description="Selecciona un jugador ya registrado en la organización."
        />
        <ActionMessage ok={existingState.ok} message={existingState.message} />
        <form action={existingAction} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="seasonTeamId" value={seasonTeamId} />

          <div className="space-y-1.5">
            <label htmlFor="playerId" className="block text-sm font-medium">
              Jugador
            </label>
            <select
              id="playerId"
              name="playerId"
              required
              disabled={existingPending || availablePlayers.length === 0}
              defaultValue={String(existingValues?.playerId ?? "")}
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
                existingState.fieldErrors?.playerId && "border-danger"
              )}
            >
              <option value="">Selecciona un jugador</option>
              {availablePlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.full_name}
                </option>
              ))}
            </select>
            <FieldError message={existingState.fieldErrors?.playerId} />
            {availablePlayers.length === 0 && (
              <p className="text-sm text-muted">
                No hay jugadores disponibles fuera del plantel activo.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="existingJerseyNumber"
              className="block text-sm font-medium"
            >
              Dorsal{" "}
              <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="existingJerseyNumber"
              name="jerseyNumber"
              inputMode="numeric"
              disabled={existingPending}
              defaultValue={String(existingValues?.jerseyNumber ?? "")}
              placeholder="7"
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                existingState.fieldErrors?.jerseyNumber && "border-danger"
              )}
            />
            <FieldError message={existingState.fieldErrors?.jerseyNumber} />
          </div>

          <SubmitButton
            pending={existingPending}
            className="w-auto"
            disabled={availablePlayers.length === 0}
          >
            Agregar al plantel
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
