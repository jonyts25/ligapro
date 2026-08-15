"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { deleteCompetitionAction } from "@/lib/competitions/actions";
import { initialCompetitionActionState } from "@/lib/competitions/types";

type CompetitionDeletePanelProps = {
  organizationId: string;
  competitionId: string;
  competitionName: string;
};

export function CompetitionDeletePanel({
  organizationId,
  competitionId,
  competitionName,
}: CompetitionDeletePanelProps) {
  const [state, action, pending] = useActionState(
    deleteCompetitionAction,
    initialCompetitionActionState
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="space-y-4 border-danger/30 p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">
          Eliminar torneo
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Borra permanentemente «{competitionName}». Solo disponible cuando no
          tiene temporadas.
        </p>
      </div>

      {state.message && !state.ok && (
        <p
          className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input
          type="hidden"
          name="confirmed"
          value={confirmDelete ? "1" : "0"}
        />

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex min-h-11 items-center rounded-xl border border-danger/40 bg-danger/10 px-4 text-sm font-medium text-danger hover:bg-danger/15"
          >
            Eliminar torneo…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              ¿Eliminar «{competitionName}»? Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-wrap gap-2">
              <SubmitButton pending={pending} className="w-auto px-4">
                Confirmar eliminación
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
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
