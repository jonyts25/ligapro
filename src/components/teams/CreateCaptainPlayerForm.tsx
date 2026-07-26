"use client";

import { useActionState } from "react";
import { createCaptainPlayerWithInvitationAction } from "@/lib/teams/actions";
import { initialTeamsActionState } from "@/lib/teams/types";
import { InviteLinkResult } from "@/components/teams/InviteLinkResult";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type CreateCaptainPlayerFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  teamLabel: string;
};

export function CreateCaptainPlayerForm({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  teamLabel,
}: CreateCaptainPlayerFormProps) {
  const [state, action, pending] = useActionState(
    createCaptainPlayerWithInvitationAction,
    initialTeamsActionState
  );
  const values = state.values ?? {};

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Invitar capitán (jugador nuevo)"
        description="Crea al jugador, lo designa capitán y genera la invitación por correo."
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
      <InviteLinkResult
        inviteUrl={state.inviteUrl}
        whatsAppHref={state.whatsAppHref}
      />
      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
        <input type="hidden" name="teamLabel" value={teamLabel} />
        <div className="space-y-1.5">
          <label htmlFor="capFullName" className="block text-sm font-medium">
            Nombre completo
          </label>
          <input
            id="capFullName"
            name="fullName"
            required
            defaultValue={String(values.fullName ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="capEmail" className="block text-sm font-medium">
            Correo de invitación
          </label>
          <input
            id="capEmail"
            name="email"
            type="email"
            required
            defaultValue={String(values.email ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="capPhone" className="block text-sm font-medium">
            Teléfono para WhatsApp{" "}
            <span className="font-normal text-muted">(opcional, no se guarda)</span>
          </label>
          <input
            id="capPhone"
            name="phone"
            type="tel"
            defaultValue={String(values.phone ?? "")}
            disabled={pending}
            placeholder="+52 55 1234 5678"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="capJersey" className="block text-sm font-medium">
            Dorsal <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="capJersey"
            name="jerseyNumber"
            defaultValue={String(values.jerseyNumber ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <SubmitButton pending={pending} className="w-auto">
          Crear e invitar capitán
        </SubmitButton>
      </form>
    </Card>
  );
}
