"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createVenueAction,
  updateVenueAction,
} from "@/lib/venues/actions";
import { initialVenueActionState } from "@/lib/venues/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { VenueRecord } from "@/lib/venues/types";

type VenueFormProps = {
  organizationId: string;
  mode: "create" | "edit";
  venue?: VenueRecord;
};

export function VenueForm({ organizationId, mode, venue }: VenueFormProps) {
  const action = mode === "create" ? createVenueAction : updateVenueAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialVenueActionState
  );

  const name = state.values?.name ?? venue?.name ?? "";
  const address = state.values?.address ?? venue?.address ?? "";
  const isActive = state.values?.isActive ?? venue?.is_active ?? true;

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
        {mode === "edit" && venue && (
          <input type="hidden" name="venueId" value={venue.id} />
        )}

        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-text-primary">
            Nombre de la sede
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none",
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

        <div className="space-y-1.5">
          <label htmlFor="address" className="block text-sm font-medium text-text-primary">
            Dirección o ubicación
          </label>
          <input
            id="address"
            name="address"
            defaultValue={address ?? ""}
            maxLength={200}
            disabled={pending}
            placeholder="Opcional"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={isActive}
            disabled={pending}
          />
          Sede activa
        </label>
        <p className="text-xs text-muted">
          Desactivar una sede no elimina canchas ni disponibilidad. Los datos
          históricos permanecen.
        </p>

        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending}>
            {mode === "create" ? "Crear sede" : "Guardar cambios"}
          </SubmitButton>
          <Link
            href={
              mode === "edit" && venue
                ? `/organizaciones/${organizationId}/sedes/${venue.id}`
                : `/organizaciones/${organizationId}/sedes`
            }
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </Card>
  );
}
