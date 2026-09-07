"use client";

import { useActionState } from "react";
import Link from "next/link";
import { startTournamentWizardAction } from "@/lib/tournament-wizard/actions";
import { initialTournamentWizardActionState } from "@/lib/tournament-wizard/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type TournamentWizardStep1FormProps = {
  organizationId: string;
  defaultFieldCount: number;
  torneosAtLimit: boolean;
  torneosLimitMessage: string | null;
  canchasAtLimit: boolean;
  canchasLimitMessage: string | null;
};

export function TournamentWizardStep1Form({
  organizationId,
  defaultFieldCount,
  torneosAtLimit,
  torneosLimitMessage,
  canchasAtLimit,
  canchasLimitMessage,
}: TournamentWizardStep1FormProps) {
  const [state, formAction, pending] = useActionState(
    startTournamentWizardAction,
    initialTournamentWizardActionState
  );

  const values = state.values ?? {};
  const fieldCountValue = canchasAtLimit
    ? "0"
    : String(values.fieldCount ?? defaultFieldCount);
  const showFormError = !state.ok && Boolean(state.message);

  return (
    <Card>
      {torneosAtLimit && torneosLimitMessage && (
        <p
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {torneosLimitMessage}
        </p>
      )}

      {canchasAtLimit && canchasLimitMessage && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {canchasLimitMessage} Usaremos las canchas que ya tienes configuradas.
        </p>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="organizationId" value={organizationId} />

        <div className="space-y-1.5">
          <label htmlFor="tournamentName" className="block text-sm font-medium">
            ¿Cómo se llama tu torneo?
          </label>
          <input
            id="tournamentName"
            name="tournamentName"
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
            defaultValue={String(values.tournamentName ?? "")}
            placeholder="Liga de verano 2026"
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              state.fieldErrors?.tournamentName && "border-danger"
            )}
          />
          {state.fieldErrors?.tournamentName && (
            <p className="text-xs text-danger">{state.fieldErrors.tournamentName}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="approximateTeams" className="block text-sm font-medium">
            ¿Cuántos equipos aproximadamente?
          </label>
          <input
            id="approximateTeams"
            name="approximateTeams"
            type="number"
            min={2}
            max={64}
            required
            disabled={pending}
            defaultValue={String(values.approximateTeams ?? "4")}
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              state.fieldErrors?.approximateTeams && "border-danger"
            )}
          />
          <p className="text-xs text-muted">
            Solo nos ayuda a preparar el siguiente paso; no crea equipos todavía.
          </p>
          {state.fieldErrors?.approximateTeams && (
            <p className="text-xs text-danger">{state.fieldErrors.approximateTeams}</p>
          )}
        </div>

        {canchasAtLimit ? (
          <input type="hidden" name="fieldCount" value="0" />
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="fieldCount" className="block text-sm font-medium">
              ¿Cuántas canchas vas a usar?
            </label>
            <input
              id="fieldCount"
              name="fieldCount"
              type="number"
              min={1}
              max={16}
              required
              disabled={pending}
              defaultValue={fieldCountValue}
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
                state.fieldErrors?.fieldCount && "border-danger"
              )}
            />
            {state.fieldErrors?.fieldCount && (
              <p className="text-xs text-danger">{state.fieldErrors.fieldCount}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} className="w-auto">
            Crear torneo y continuar
          </SubmitButton>
          <Link
            href={`/organizaciones/${organizationId}/torneos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Cancelar
          </Link>
        </div>

        {showFormError && (
          <p
            className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {state.message}
          </p>
        )}
      </form>
    </Card>
  );
}
