"use client";

import { useActionState } from "react";
import { createPlayerAndAddCaptainAction } from "@/lib/captain/actions";
import { initialCaptainActionState } from "@/lib/captain/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type CaptainAddPlayerFormProps = {
  seasonTeamId: string;
};

export function CaptainAddPlayerForm({ seasonTeamId }: CaptainAddPlayerFormProps) {
  const [state, action, pending] = useActionState(
    createPlayerAndAddCaptainAction,
    initialCaptainActionState
  );

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Agregar jugador"
        description="Solo puedes dar de alta jugadores nuevos en tu plantel. No puedes editar ni dar de baja jugadores existentes."
      />
      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <form action={action} className="space-y-4">
        <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
        <div className="space-y-1.5">
          <label htmlFor="captainFullName" className="block text-sm font-medium">
            Nombre completo
          </label>
          <input
            id="captainFullName"
            name="fullName"
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
            placeholder="Juan Pérez García"
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              state.fieldErrors?.fullName && "border-danger"
            )}
          />
          {state.fieldErrors?.fullName && (
            <p className="text-xs text-danger" role="alert">
              {state.fieldErrors.fullName}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="captainJersey" className="block text-sm font-medium">
            Dorsal{" "}
            <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="captainJersey"
            name="jerseyNumber"
            inputMode="numeric"
            disabled={pending}
            placeholder="10"
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              state.fieldErrors?.jerseyNumber && "border-danger"
            )}
          />
          {state.fieldErrors?.jerseyNumber && (
            <p className="text-xs text-danger" role="alert">
              {state.fieldErrors.jerseyNumber}
            </p>
          )}
        </div>
        <SubmitButton pending={pending} className="w-auto">
          Agregar al plantel
        </SubmitButton>
      </form>
    </Card>
  );
}
