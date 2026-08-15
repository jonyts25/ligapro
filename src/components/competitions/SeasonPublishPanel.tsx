"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { publishSeasonAction } from "@/lib/competitions/actions";
import {
  getSeasonReadinessStatus,
  seasonReadinessBlockedMessage,
} from "@/lib/competitions/season-readiness";
import { initialCompetitionActionState } from "@/lib/competitions/types";
import type { SeasonDetail } from "@/lib/competitions/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";

type SeasonPublishPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  season: SeasonDetail;
  publicHref: string;
};

export function SeasonPublishPanel({
  organizationId,
  competitionId,
  seasonId,
  season,
  publicHref,
}: SeasonPublishPanelProps) {
  const [state, action, pending] = useActionState(
    publishSeasonAction,
    initialCompetitionActionState
  );
  const [confirmPublish, setConfirmPublish] = useState(false);
  const readiness = getSeasonReadinessStatus(season);
  const blockedMessage = seasonReadinessBlockedMessage(readiness.pendingLabels);

  if (season.visibility === "public") {
    return (
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Página pública
        </h2>
        <p className="text-sm text-text-secondary">
          Esta temporada es pública. Cualquiera con el enlace puede consultar
          calendario, posiciones, goleadores y disciplina.
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
        <Link
          href={publicHref}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent"
          target="_blank"
          rel="noreferrer"
        >
          Abrir página pública
        </Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">
          Publicar temporada
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Hace visible la página pública (calendario, posiciones, goleadores y
          disciplina). Requiere checklist de preparación completo.
        </p>
      </div>

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
        <input
          type="hidden"
          name="confirmed"
          value={confirmPublish ? "1" : "0"}
        />

        {!readiness.complete ? (
          <span title={blockedMessage} className="inline-block">
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-muted opacity-70"
            >
              Publicar
            </button>
          </span>
        ) : !confirmPublish ? (
          <button
            type="button"
            onClick={() => setConfirmPublish(true)}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            Publicar…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              ¿Publicar «{season.name}»? Cualquiera con el enlace podrá ver la
              información de la temporada.
            </p>
            <div className="flex flex-wrap gap-2">
              <SubmitButton pending={pending} className="w-auto px-4">
                Confirmar publicación
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirmPublish(false)}
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
