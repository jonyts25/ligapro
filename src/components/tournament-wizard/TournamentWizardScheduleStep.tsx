"use client";

import { useActionState } from "react";
import Link from "next/link";
import { wizardSetScheduleAction } from "@/lib/tournament-wizard/actions";
import { initialTournamentWizardActionState } from "@/lib/tournament-wizard/types";
import { DAY_LABELS_ES } from "@/lib/venues/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type TournamentWizardScheduleStepProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  fieldIds: string[];
  fieldNames: string[];
};

export function TournamentWizardScheduleStep({
  organizationId,
  competitionId,
  seasonId,
  fieldIds,
  fieldNames,
}: TournamentWizardScheduleStepProps) {
  const [state, formAction, pending] = useActionState(
    wizardSetScheduleAction,
    initialTournamentWizardActionState
  );

  const values = state.values ?? {};

  return (
    <Card>
      {state.message && (
        <p
          className={cn(
            "mb-4 rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}

      <p className="mb-4 text-base text-text-primary">
        ¿Qué días juegan? Configuramos la disponibilidad habitual de{" "}
        {fieldNames.length === 1
          ? "tu cancha"
          : `tus ${fieldNames.length} canchas`}{" "}
        y el bloqueo de cancha de la temporada con el mismo horario.
      </p>

      {fieldNames.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          Canchas: {fieldNames.join(", ")}
        </p>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="fieldIds" value={JSON.stringify(fieldIds)} />

        <div className="space-y-1.5">
          <label htmlFor="dayOfWeek" className="block text-sm font-medium">
            Día de la semana
          </label>
          <select
            id="dayOfWeek"
            name="dayOfWeek"
            required
            disabled={pending}
            defaultValue={String(values.dayOfWeek ?? "6")}
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              state.fieldErrors?.dayOfWeek && "border-danger"
            )}
          >
            {DAY_LABELS_ES.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.dayOfWeek && (
            <p className="text-xs text-danger">{state.fieldErrors.dayOfWeek}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="startsAt" className="block text-sm font-medium">
              Hora de inicio
            </label>
            <input
              id="startsAt"
              name="startsAt"
              type="time"
              required
              disabled={pending}
              defaultValue={String(values.startsAt ?? "09:00")}
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
                state.fieldErrors?.startsAt && "border-danger"
              )}
            />
            {state.fieldErrors?.startsAt && (
              <p className="text-xs text-danger">{state.fieldErrors.startsAt}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="endsAt" className="block text-sm font-medium">
              Hora de fin
            </label>
            <input
              id="endsAt"
              name="endsAt"
              type="time"
              required
              disabled={pending}
              defaultValue={String(values.endsAt ?? "14:00")}
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
                state.fieldErrors?.endsAt && "border-danger"
              )}
            />
            {state.fieldErrors?.endsAt && (
              <p className="text-xs text-danger">{state.fieldErrors.endsAt}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} className="w-auto">
            Guardar horario y continuar
          </SubmitButton>
          <Link
            href={`/organizaciones/${organizationId}/torneos/asistente/${competitionId}/${seasonId}/jugadores`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        </div>
      </form>
    </Card>
  );
}
