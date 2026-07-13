"use client";

import { useActionState } from "react";
import {
  createFieldAction,
  updateFieldAction,
} from "@/lib/venues/actions";
import { initialVenueActionState } from "@/lib/venues/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { FieldRecord } from "@/lib/venues/types";

type FieldFormProps = {
  organizationId: string;
  venueId: string;
  mode: "create" | "edit";
  field?: FieldRecord;
  onCancelEdit?: () => void;
};

export function FieldForm({
  organizationId,
  venueId,
  mode,
  field,
  onCancelEdit,
}: FieldFormProps) {
  const action = mode === "create" ? createFieldAction : updateFieldAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialVenueActionState
  );

  const name = state.values?.name ?? field?.name ?? "";
  const surfaceType =
    state.values?.surfaceType ?? field?.surface_type ?? "";
  const isActive = state.values?.isActive ?? field?.is_active ?? true;

  return (
    <Card className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">
        {mode === "create" ? "Agregar cancha" : "Editar cancha"}
      </h3>
      {state.message && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="venueId" value={venueId} />
        {mode === "edit" && field && (
          <input type="hidden" name="fieldId" value={field.id} />
        )}
        <div className="space-y-1.5">
          <label htmlFor={`field-name-${field?.id ?? "new"}`} className="block text-sm font-medium">
            Nombre
          </label>
          <input
            id={`field-name-${field?.id ?? "new"}`}
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
            placeholder="Cancha 1"
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            )}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`surface-${field?.id ?? "new"}`} className="block text-sm font-medium">
            Superficie
          </label>
          <input
            id={`surface-${field?.id ?? "new"}`}
            name="surfaceType"
            defaultValue={surfaceType ?? ""}
            maxLength={80}
            disabled={pending}
            placeholder="Pasto sintético, techada…"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={isActive}
            disabled={pending}
          />
          Cancha activa
        </label>
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending}>
            {mode === "create" ? "Crear cancha" : "Guardar cancha"}
          </SubmitButton>
          {mode === "edit" && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
