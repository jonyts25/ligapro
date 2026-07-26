"use client";

import { useActionState } from "react";
import { inviteCaptainToRosterAction } from "@/lib/teams/actions";
import { initialTeamsActionState } from "@/lib/teams/types";
import { InviteLinkResult } from "@/components/teams/InviteLinkResult";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { cn } from "@/lib/utils/cn";

type InviteCaptainToRosterFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  rosterId: string;
  teamLabel: string;
  playerName: string;
  roleLabel: "capitán" | "subcapitán";
};

export function InviteCaptainToRosterForm({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  rosterId,
  teamLabel,
  playerName,
  roleLabel,
}: InviteCaptainToRosterFormProps) {
  const [state, action, pending] = useActionState(
    inviteCaptainToRosterAction,
    initialTeamsActionState
  );
  const values = state.values ?? {};

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-sm font-medium text-text-primary">
        Invitar {roleLabel}: {playerName}
      </p>
      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-xs",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <InviteLinkResult
        inviteUrl={state.inviteUrl}
        whatsAppHref={state.whatsAppHref}
      />
      <form action={action} className="space-y-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
        <input type="hidden" name="rosterId" value={rosterId} />
        <input type="hidden" name="teamLabel" value={teamLabel} />
        <div className="space-y-1.5">
          <label htmlFor={`invite-email-${rosterId}`} className="block text-sm">
            Correo de invitación
          </label>
          <input
            id={`invite-email-${rosterId}`}
            name="email"
            type="email"
            required
            defaultValue={String(values.email ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`invite-phone-${rosterId}`} className="block text-sm">
            Teléfono para WhatsApp{" "}
            <span className="text-muted">(opcional, no se guarda)</span>
          </label>
          <input
            id={`invite-phone-${rosterId}`}
            name="phone"
            type="tel"
            defaultValue={String(values.phone ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <SubmitButton pending={pending} className="w-auto">
          Enviar invitación
        </SubmitButton>
      </form>
    </div>
  );
}
