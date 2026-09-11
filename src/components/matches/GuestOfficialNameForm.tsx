"use client";

import { useActionState } from "react";
import {
  initialCaptureActionState,
  setGuestOfficialNameAction,
} from "@/lib/matches/guest-actions";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type GuestOfficialNameFormProps = {
  inviteToken: string;
};

export function GuestOfficialNameForm({ inviteToken }: GuestOfficialNameFormProps) {
  const [state, action, pending] = useActionState(
    setGuestOfficialNameAction,
    initialCaptureActionState
  );

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Invitación arbitral</h1>
        <p className="text-sm text-text-secondary">
          Indica tu nombre para capturar este partido. No necesitas crear una cuenta.
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
        >
          {state.message}
        </p>
      )}
      <form action={action} className="space-y-3">
        <input type="hidden" name="inviteToken" value={inviteToken} />
        <div className="space-y-1.5">
          <label htmlFor="guestName" className="block text-sm font-medium">
            Tu nombre
          </label>
          <input
            id="guestName"
            name="guestName"
            type="text"
            required
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
          {state.fieldErrors?.guestName && (
            <p className="text-xs text-danger">{state.fieldErrors.guestName}</p>
          )}
        </div>
        <SubmitButton pending={pending}>Continuar a captura</SubmitButton>
      </form>
    </Card>
  );
}
