"use client";

import { useActionState } from "react";
import { updateCaptainProfileAction } from "@/lib/captain/actions";
import { initialCaptainActionState } from "@/lib/captain/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type CaptainProfileFormProps = {
  displayName: string | null;
  email: string;
  phone: string | null;
};

export function CaptainProfileForm({
  displayName,
  email,
  phone,
}: CaptainProfileFormProps) {
  const [state, action, pending] = useActionState(
    updateCaptainProfileAction,
    initialCaptainActionState
  );

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Mi perfil"
        description="Tu nombre y teléfono se usan para contacto con rivales (WhatsApp)."
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
        <div className="space-y-1.5">
          <label htmlFor="profileEmail" className="block text-sm font-medium">
            Correo
          </label>
          <input
            id="profileEmail"
            value={email}
            readOnly
            className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-muted"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="displayName" className="block text-sm font-medium">
            Nombre para mostrar
          </label>
          <input
            id="displayName"
            name="displayName"
            defaultValue={displayName ?? ""}
            maxLength={100}
            disabled={pending}
            placeholder="Tu nombre"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
          {state.fieldErrors?.displayName && (
            <p className="text-xs text-danger" role="alert">
              {state.fieldErrors.displayName}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="block text-sm font-medium">
            Teléfono{" "}
            <span className="font-normal text-muted">(opcional, para WhatsApp)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            disabled={pending}
            placeholder="+52 55 1234 5678"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <SubmitButton pending={pending} className="w-auto">
          Guardar perfil
        </SubmitButton>
      </form>
    </Card>
  );
}
