"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import {
  archiveSeasonAction,
  reactivateSeasonAction,
} from "@/lib/competitions/actions";
import {
  initialCompetitionActionState,
  visibilityLabel,
} from "@/lib/competitions/types";
import { SEASON_REACTIVATE_OPTIONS } from "@/lib/competitions/season-visibility";

type SeasonArchivePanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  isArchived: boolean;
};

export function SeasonArchivePanel({
  organizationId,
  competitionId,
  seasonId,
  isArchived,
}: SeasonArchivePanelProps) {
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveSeasonAction,
    initialCompetitionActionState
  );
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(
    reactivateSeasonAction,
    initialCompetitionActionState
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);

  const hidden = (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
    </>
  );

  const message = archiveState.message ?? reactivateState.message;
  const messageOk = archiveState.ok || reactivateState.ok;

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">
          {isArchived ? "Reactivar temporada" : "Archivar temporada"}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {isArchived
            ? "Vuelve a habilitar la gestión operativa. Elige el estado de visibilidad al reactivar."
            : "La temporada deja de estar activa para gestión diaria. No se borran partidos, resultados, cargos ni disciplina. Si era pública, dejará de aparecer en las páginas públicas."}
        </p>
      </div>

      {message && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            messageOk
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role={messageOk ? "status" : "alert"}
        >
          {message}
        </p>
      )}

      {isArchived ? (
        <form action={reactivateAction} className="space-y-3">
          {hidden}
          <input
            type="hidden"
            name="confirmed"
            value={confirmReactivate ? "1" : "0"}
          />
          <label className="block text-sm font-medium" htmlFor="reactivateVisibility">
            Estado al reactivar
          </label>
          <select
            id="reactivateVisibility"
            name="visibility"
            defaultValue="private"
            disabled={reactivatePending}
            className="min-h-11 w-full max-w-xs rounded-xl border border-border bg-background px-3 text-sm"
          >
            {SEASON_REACTIVATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {!confirmReactivate ? (
            <button
              type="button"
              onClick={() => setConfirmReactivate(true)}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-elevated"
            >
              Reactivar…
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <SubmitButton pending={reactivatePending} className="w-auto px-4">
                Confirmar reactivación
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirmReactivate(false)}
                className="inline-flex min-h-11 items-center px-3 text-sm text-text-secondary"
              >
                Cancelar
              </button>
            </div>
          )}
        </form>
      ) : (
        <form action={archiveAction} className="space-y-3">
          {hidden}
          <input
            type="hidden"
            name="confirmed"
            value={confirmArchive ? "1" : "0"}
          />
          {!confirmArchive ? (
            <button
              type="button"
              onClick={() => setConfirmArchive(true)}
              className="inline-flex min-h-11 items-center rounded-xl border border-warning/40 bg-warning/10 px-4 text-sm font-medium text-text-primary hover:bg-warning/15"
            >
              Archivar temporada…
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                ¿Archivar? Podrás reactivarla después ({SEASON_REACTIVATE_OPTIONS.map((o) => visibilityLabel(o.value)).join(", ")}).
              </p>
              <div className="flex flex-wrap gap-2">
                <SubmitButton pending={archivePending} className="w-auto px-4">
                  Confirmar archivado
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(false)}
                  className="inline-flex min-h-11 items-center px-3 text-sm text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
