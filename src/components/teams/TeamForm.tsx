"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createTeamAction,
  createTeamsBulkAction,
  updateTeamAction,
} from "@/lib/teams/actions";
import {
  initialTeamsActionState,
  type TeamRecord,
} from "@/lib/teams/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type TeamFormProps = {
  organizationId: string;
  mode: "create" | "edit";
  team?: TeamRecord;
};

export function TeamForm({ organizationId, mode, team }: TeamFormProps) {
  const action = mode === "create" ? createTeamAction : updateTeamAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialTeamsActionState
  );
  const [bulkState, bulkAction, bulkPending] = useActionState(
    createTeamsBulkAction,
    initialTeamsActionState
  );
  const [bulkMode, setBulkMode] = useState(false);
  const name = String(state.values?.name ?? team?.name ?? "");

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
      {bulkState.message && (
        <p
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            bulkState.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role={bulkState.ok ? "status" : "alert"}
        >
          {bulkState.message}
        </p>
      )}
      {mode === "create" && (
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setBulkMode(false)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              !bulkMode ? "border-brand bg-brand/10 text-brand" : "border-border"
            }`}
          >
            Un equipo
          </button>
          <button
            type="button"
            onClick={() => setBulkMode(true)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              bulkMode ? "border-brand bg-brand/10 text-brand" : "border-border"
            }`}
          >
            Pegar lista
          </button>
        </div>
      )}
      {mode === "create" && bulkMode ? (
        <form action={bulkAction} className="space-y-5">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="space-y-1.5">
            <label htmlFor="bulkList" className="block text-sm font-medium">
              Nombres de equipos (uno por línea)
            </label>
            <textarea
              id="bulkList"
              name="bulkList"
              required
              rows={8}
              disabled={bulkPending}
              placeholder={"Halcones FC\nLeones SC\n..."}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <SubmitButton pending={bulkPending} className="w-auto">
            Crear equipos
          </SubmitButton>
        </form>
      ) : (
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        {mode === "edit" && team && (
          <input type="hidden" name="teamId" value={team.id} />
        )}
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium">
            Nombre del equipo
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
            placeholder="Los Halcones FC"
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
          El nombre identifica al equipo en toda la organización. Puedes usar un
          nombre distinto al inscribirlo en cada temporada.
        </p>
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} className="w-auto">
            {mode === "create" ? "Crear equipo" : "Guardar cambios"}
          </SubmitButton>
          <Link
            href={
              mode === "edit" && team
                ? `/organizaciones/${organizationId}/equipos/${team.id}`
                : `/organizaciones/${organizationId}/equipos`
            }
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Cancelar
          </Link>
        </div>
      </form>
      )}
    </Card>
  );
}
