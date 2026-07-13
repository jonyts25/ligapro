"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createCompetitionAction,
  updateCompetitionAction,
} from "@/lib/competitions/actions";
import { initialCompetitionActionState } from "@/lib/competitions/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { CompetitionRecord } from "@/lib/competitions/types";

type CompetitionFormProps = {
  organizationId: string;
  mode: "create" | "edit";
  competition?: CompetitionRecord;
};

export function CompetitionForm({
  organizationId,
  mode,
  competition,
}: CompetitionFormProps) {
  const action =
    mode === "create" ? createCompetitionAction : updateCompetitionAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialCompetitionActionState
  );
  const name = String(state.values?.name ?? competition?.name ?? "");

  return (
    <Card>
      {state.message && (
        <p
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        {mode === "edit" && competition && (
          <input type="hidden" name="competitionId" value={competition.id} />
        )}
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium">
            Nombre del torneo
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
            placeholder="Liga Dominical Fútbol 7 Libre"
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              state.fieldErrors?.name && "border-danger"
            )}
          />
          {state.fieldErrors?.name && (
            <p className="text-xs text-danger" role="alert">
              {state.fieldErrors.name}
            </p>
          )}
        </div>
        <p className="text-xs text-muted">
          Si necesitas categorías con reglas o calendarios distintos, crea
          torneos separados (por ejemplo Libre y Veteranos +35).
        </p>
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending}>
            {mode === "create" ? "Crear torneo" : "Guardar cambios"}
          </SubmitButton>
          <Link
            href={
              mode === "edit" && competition
                ? `/organizaciones/${organizationId}/torneos/${competition.id}`
                : `/organizaciones/${organizationId}/torneos`
            }
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </Card>
  );
}
