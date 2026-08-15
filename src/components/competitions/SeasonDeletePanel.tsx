"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { deleteSeasonAction } from "@/lib/competitions/actions";
import { initialCompetitionActionState } from "@/lib/competitions/types";

type SeasonDeletePanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonName: string;
};

export function SeasonDeletePanel({
  organizationId,
  competitionId,
  seasonId,
  seasonName,
}: SeasonDeletePanelProps) {
  const [state, action, pending] = useActionState(
    deleteSeasonAction,
    initialCompetitionActionState
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="space-y-4 border-danger/30 p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">
          Eliminar temporada
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Borra permanentemente «{seasonName}» y su configuración. Solo disponible
          en borrador y sin equipos inscritos.
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
        <input type="hidden" name="seasonId" value={seasonId} />
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
            Eliminar temporada…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              ¿Eliminar «{seasonName}»? Esta acción no se puede deshacer.
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
