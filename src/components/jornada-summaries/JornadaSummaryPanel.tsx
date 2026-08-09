"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enqueueJornadaSummaryAction,
  initialJornadaSummaryActionState,
  setJornadaSummaryPublishedAction,
} from "@/lib/jornada-summaries/actions";
import type { JornadaSummaryRecord } from "@/lib/jornada-summaries/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type JobRow = {
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
};

type JornadaSummaryPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  roundNumber: number;
  hasPremium: boolean;
  canManage: boolean;
  summary: JornadaSummaryRecord | null;
  job: JobRow | null;
  hasFinishedMatches: boolean;
};

export function JornadaSummaryPanel({
  organizationId,
  competitionId,
  seasonId,
  roundNumber,
  hasPremium,
  canManage,
  summary,
  job,
  hasFinishedMatches,
}: JornadaSummaryPanelProps) {
  const router = useRouter();
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [enqueueState, enqueueAction, enqueuePending] = useActionState(
    enqueueJornadaSummaryAction,
    initialJornadaSummaryActionState
  );
  const [publishState, publishAction, publishPending] = useActionState(
    setJornadaSummaryPublishedAction,
    initialJornadaSummaryActionState
  );

  if (!hasPremium || !canManage) {
    return null;
  }

  const message = enqueueState.message ?? publishState.message;
  const messageOk = enqueueState.ok || publishState.ok;

  return (
    <Card className="space-y-4 border-brand/20 bg-brand/5">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          Resumen de jornada (IA · Premium)
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          Se genera en borrador; revisa y publica manualmente antes de que sea
          visible.
        </p>
      </div>

      {message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            messageOk
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={messageOk ? "status" : "alert"}
        >
          {message}
        </p>
      )}

      {job && (
        <p className="text-xs text-text-secondary">
          Trabajo IA: {job.status}
          {job.error_message ? ` — ${job.error_message}` : ""}
        </p>
      )}

      {summary ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-text-primary">Jugador de la jornada</p>
            <p className="text-text-secondary">{summary.content.jugador_jornada || "—"}</p>
          </div>
          <div>
            <p className="font-medium text-text-primary">Sorprendió</p>
            <p className="text-text-secondary">{summary.content.sorprendio || "—"}</p>
          </div>
          <div>
            <p className="font-medium text-text-primary">Decepcionó</p>
            <p className="text-text-secondary">{summary.content.decepciono || "—"}</p>
          </div>
          <div>
            <p className="font-medium text-text-primary">Resumen general</p>
            <p className="whitespace-pre-wrap text-text-secondary">
              {summary.content.resumen_general || "—"}
            </p>
          </div>
          <p className="text-xs text-text-secondary">
            {summary.isPublished ? "Publicado" : "Borrador — no visible públicamente"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          {hasFinishedMatches
            ? "Aún no hay resumen generado para esta jornada."
            : "Finaliza al menos un partido con marcador para generar el resumen."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={enqueueAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="roundNumber" value={roundNumber} />
          {confirmRegenerate && (
            <input type="hidden" name="confirmRegenerate" value="true" />
          )}
          <SubmitButton
            pending={enqueuePending}
            disabled={!hasFinishedMatches}
            className="w-auto px-4"
          >
            {summary ? "Regenerar resumen" : "Generar resumen"}
          </SubmitButton>
        </form>

        {enqueueState.needsConfirm && !confirmRegenerate && (
          <button
            type="button"
            onClick={() => setConfirmRegenerate(true)}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Confirmar regeneración
          </button>
        )}

        {summary && (
          <form action={publishAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="seasonId" value={seasonId} />
            <input type="hidden" name="roundNumber" value={roundNumber} />
            <input
              type="hidden"
              name="publish"
              value={summary.isPublished ? "false" : "true"}
            />
            <SubmitButton pending={publishPending} className="w-auto px-4">
              {summary.isPublished ? "Despublicar" : "Publicar"}
            </SubmitButton>
          </form>
        )}

        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
        >
          Actualizar estado
        </button>
      </div>
    </Card>
  );
}
