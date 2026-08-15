"use client";

import { useActionState, useState } from "react";
import { confirmTeamRegistrationAction } from "@/lib/teams/actions";
import { initialTeamsActionState, type SeasonTeamDetail } from "@/lib/teams/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

type ConfirmSeasonTeamPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeam: SeasonTeamDetail;
};

export function ConfirmSeasonTeamPanel({
  organizationId,
  competitionId,
  seasonId,
  seasonTeam,
}: ConfirmSeasonTeamPanelProps) {
  const [state, action, pending] = useActionState(
    confirmTeamRegistrationAction,
    initialTeamsActionState
  );
  const [confirm, setConfirm] = useState(false);

  if (seasonTeam.registration_status !== "registered") {
    return null;
  }

  const maxLabel =
    seasonTeam.maxRosterSize != null
      ? `${seasonTeam.maxRosterSize} jugadores`
      : "sin límite";

  return (
    <Card className="space-y-4 border-brand/20 p-4">
      <SectionHeader
        title="Confirmar equipo"
        description="Pasa el equipo de pendiente a confirmado y bloquea el plantel del capitán."
        className="mb-0"
      />

      <p className="text-sm text-text-secondary">
        Jugadores activos: {seasonTeam.activePlayerCount}. Tope de plantel:{" "}
        {maxLabel}.
      </p>

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

      <form action={action} className="space-y-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="seasonTeamId" value={seasonTeam.id} />
        <input type="hidden" name="confirmed" value={confirm ? "1" : "0"} />

        {!confirm ? (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            Confirmar equipo…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              ¿Confirmar este equipo? El capitán no podrá agregar jugadores ni
              cambiar dorsales hasta que un administrador lo desbloquee.
            </p>
            <div className="flex flex-wrap gap-2">
              <SubmitButton pending={pending} className="w-auto px-4">
                Confirmar equipo
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="inline-flex min-h-11 items-center px-3 text-sm text-text-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}
