"use client";

import { useActionState } from "react";
import { splitFieldAction } from "@/lib/venues/actions";
import { initialVenueActionState } from "@/lib/venues/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type FieldSplitFormProps = {
  organizationId: string;
  fieldId: string;
  fieldName: string;
};

export function FieldSplitForm({
  organizationId,
  fieldId,
  fieldName,
}: FieldSplitFormProps) {
  const [state, formAction, pending] = useActionState(
    splitFieldAction,
    initialVenueActionState
  );

  const childName1 = String(state.values?.childName1 ?? `${fieldName} A`);
  const childName2 = String(state.values?.childName2 ?? `${fieldName} B`);

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          Dividir en 2 canchas de Fútbol 7
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Crea dos mitades independientes bajo esta cancha. Reservar la cancha
          completa bloqueará ambas mitades, pero las mitades pueden reservarse
          en paralelo entre sí.
        </p>
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

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="fieldId" value={fieldId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="childName1" className="block text-sm font-medium">
              Nombre mitad 1
            </label>
            <input
              id="childName1"
              name="childName1"
              defaultValue={childName1}
              required
              minLength={2}
              maxLength={100}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            {state.fieldErrors?.childName1 && (
              <p className="text-xs text-danger">{state.fieldErrors.childName1}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="childName2" className="block text-sm font-medium">
              Nombre mitad 2
            </label>
            <input
              id="childName2"
              name="childName2"
              defaultValue={childName2}
              required
              minLength={2}
              maxLength={100}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            {state.fieldErrors?.childName2 && (
              <p className="text-xs text-danger">{state.fieldErrors.childName2}</p>
            )}
          </div>
        </div>

        <SubmitButton pending={pending} className="w-auto">
          Dividir cancha
        </SubmitButton>
      </form>
    </Card>
  );
}
