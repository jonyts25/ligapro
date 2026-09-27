"use client";

import { useActionState, useState } from "react";
import { createFieldReservationAction } from "@/lib/venues/reservation-actions";
import { initialReservationActionState } from "@/lib/venues/types";
import {
  NON_MATCH_RESERVATION_TYPES,
  RESERVATION_TYPE_LABELS,
} from "@/lib/venues/reservation-types";
import type { ReservationCalendarFieldRow } from "@/lib/venues/reservation-calendar-types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type ReservationCreateFormProps = {
  organizationId: string;
  fields: ReservationCalendarFieldRow[];
  defaultDate: string;
};

export function ReservationCreateForm({
  organizationId,
  fields,
  defaultDate,
}: ReservationCreateFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createFieldReservationAction,
    initialReservationActionState
  );

  const values = state.values ?? {};
  const fieldId = values.fieldId ?? fields[0]?.fieldId ?? "";
  const reservationType = values.reservationType ?? "private_rental";
  const date = values.date ?? defaultDate;
  const startTime = values.startTime ?? "18:00";
  const endTime = values.endTime ?? "19:00";
  const title = values.title ?? "";

  return (
    <div className="space-y-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Nueva reserva
        </button>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Nueva reserva
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Mantenimiento, renta particular, cierre o bloqueo manual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-muted hover:text-text-primary"
            >
              Cerrar
            </button>
          </div>

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

          <form action={formAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="organizationId" value={organizationId} />

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="fieldId" className="block text-sm font-medium">
                Cancha
              </label>
              <select
                id="fieldId"
                name="fieldId"
                defaultValue={fieldId}
                required
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {fields.map((field) => (
                  <option key={field.fieldId} value={field.fieldId}>
                    {field.fieldLabel}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.fieldId && (
                <p className="text-xs text-danger">{state.fieldErrors.fieldId}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="date" className="block text-sm font-medium">
                Fecha
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={date}
                required
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
              {state.fieldErrors?.date && (
                <p className="text-xs text-danger">{state.fieldErrors.date}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="reservationType"
                className="block text-sm font-medium"
              >
                Tipo
              </label>
              <select
                id="reservationType"
                name="reservationType"
                defaultValue={reservationType}
                required
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {NON_MATCH_RESERVATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {RESERVATION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.reservationType && (
                <p className="text-xs text-danger">
                  {state.fieldErrors.reservationType}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="startTime" className="block text-sm font-medium">
                Hora inicio
              </label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={startTime}
                required
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
              {state.fieldErrors?.startTime && (
                <p className="text-xs text-danger">
                  {state.fieldErrors.startTime}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="endTime" className="block text-sm font-medium">
                Hora fin
              </label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue={endTime}
                required
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
              {state.fieldErrors?.endTime && (
                <p className="text-xs text-danger">{state.fieldErrors.endTime}</p>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium">
                Título (opcional)
              </label>
              <input
                id="title"
                name="title"
                defaultValue={title}
                maxLength={200}
                disabled={pending}
                placeholder="Ej. Renta cumpleaños"
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <SubmitButton pending={pending} className="w-auto">
                Guardar reserva
              </SubmitButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
