"use client";

import { useActionState } from "react";
import { submitPublicTeamRegistrationAction } from "@/lib/teams/registration-requests-actions";
import { initialTeamsActionState } from "@/lib/teams/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type PublicTeamRegistrationFormProps = {
  organizationId: string;
  seasonSlug: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-danger" role="alert">
      {message}
    </p>
  );
}

export function PublicTeamRegistrationForm({
  organizationId,
  seasonSlug,
}: PublicTeamRegistrationFormProps) {
  const [state, action, pending] = useActionState(
    submitPublicTeamRegistrationAction,
    initialTeamsActionState
  );

  const submitted = state.ok && state.message?.includes("fue enviada");

  if (submitted) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-success" role="status">
          {state.message}
        </p>
      </Card>
    );
  }

  const v = state.values ?? {};

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Inscribir equipo</h1>
        <p className="text-sm text-text-secondary">
          Envía tu solicitud. El organizador la revisará y te contactará por
          correo si la aprueba.
        </p>
      </div>

      {state.message && !state.ok && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            "border-danger/40 bg-danger/10 text-danger"
          )}
          role="alert"
        >
          {state.message}
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="seasonSlug" value={seasonSlug} />

        <div className="space-y-1.5">
          <label htmlFor="teamName" className="block text-sm font-medium">
            Nombre del equipo
          </label>
          <input
            id="teamName"
            name="teamName"
            type="text"
            required
            disabled={pending}
            defaultValue={String(v.teamName ?? "")}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
          <FieldError message={state.fieldErrors?.teamName} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contactName" className="block text-sm font-medium">
            Tu nombre
          </label>
          <input
            id="contactName"
            name="contactName"
            type="text"
            required
            disabled={pending}
            defaultValue={String(v.contactName ?? "")}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
          <FieldError message={state.fieldErrors?.contactName} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contactEmail" className="block text-sm font-medium">
            Tu correo
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            autoComplete="email"
            disabled={pending}
            defaultValue={String(v.contactEmail ?? "")}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
          <FieldError message={state.fieldErrors?.contactEmail} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contactPhone" className="block text-sm font-medium">
            Tu teléfono <span className="text-muted">(opcional)</span>
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            disabled={pending}
            defaultValue={String(v.contactPhone ?? "")}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="requestedGroupName"
            className="block text-sm font-medium"
          >
            Grupo deseado <span className="text-muted">(opcional)</span>
          </label>
          <input
            id="requestedGroupName"
            name="requestedGroupName"
            type="text"
            disabled={pending}
            defaultValue={String(v.requestedGroupName ?? "")}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>

        <SubmitButton pending={pending}>Enviar solicitud</SubmitButton>
      </form>
    </Card>
  );
}
