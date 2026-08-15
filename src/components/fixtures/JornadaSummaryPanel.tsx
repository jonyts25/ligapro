"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enqueueJornadaSummaryAction,
  refreshJornadaSummaryAction,
  setJornadaSummaryPublishedAction,
} from "@/lib/jornada-summaries/actions";
import {
  initialJornadaSummaryActionState,
  type JornadaSummaryJobRow,
  type JornadaSummaryRow,
} from "@/lib/jornada-summaries/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type JornadaSummaryPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  roundNumber: number;
  canManage: boolean;
  hasPremium: boolean;
  summary: JornadaSummaryRow | null;
  job: JornadaSummaryJobRow | null;
};

const JOB_STATUS_LABEL: Record<string, string> = {
  pending: "En cola",
  processing: "Procesando",
  done: "Completado",
  error: "Error",
};

export function JornadaSummaryPanel({
  organizationId,
  competitionId,
  seasonId,
  seasonName,
  roundNumber,
  canManage,
  hasPremium,
  summary,
  job,
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
  const [, refreshAction, refreshPending] = useActionState(
    refreshJornadaSummaryAction,
    initialJornadaSummaryActionState
  );

  if (!hasPremium) {
    return null;
  }

  const hiddenFields = (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="roundNumber" value={roundNumber} />
      <input type="hidden" name="seasonName" value={seasonName} />
    </>
  );

  const needsConfirm =
    enqueueState.needsConfirm ||
    (summary?.isPublished && !confirmRegenerate);

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          Resumen de jornada {roundNumber} (IA)
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Feature Premium. Se genera en borrador — revisa antes de publicar. El
          modelo puede alucinar detalles incluso con marcadores correctos.
        </p>
      </div>

      {canManage && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-elevated/40 p-4">
          {(needsConfirm || enqueueState.needsConfirm) && !confirmRegenerate && (
            <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              Ya hay un resumen publicado. Generar uno nuevo lo reemplazará y
              quedará sin publicar hasta revisarlo.
            </p>
          )}

          {summary?.isPublished && !confirmRegenerate ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
              onClick={() => setConfirmRegenerate(true)}
            >
              Regenerar resumen…
            </button>
          ) : (
            <form action={enqueueAction} className="flex flex-wrap gap-2">
              {hiddenFields}
              {confirmRegenerate && (
                <input type="hidden" name="confirmRegenerate" value="true" />
              )}
              <SubmitButton pending={enqueuePending} className="w-auto">
                {summary ? "Regenerar resumen" : "Generar resumen"}
              </SubmitButton>
            </form>
          )}

          <form
            action={refreshAction}
            onSubmit={() => setTimeout(() => router.refresh(), 300)}
          >
            {hiddenFields}
            <SubmitButton pending={refreshPending} className="w-auto">
              Actualizar estado
            </SubmitButton>
          </form>

          {(enqueueState.message || publishState.message) && (
            <p
              className={cn(
                "text-sm",
                enqueueState.ok || publishState.ok
                  ? "text-success"
                  : "text-danger"
              )}
              role="alert"
            >
              {enqueueState.message ?? publishState.message}
            </p>
          )}
        </div>
      )}

      {job && (
        <p className="text-sm text-text-secondary">
          Trabajo IA: {JOB_STATUS_LABEL[job.status] ?? job.status}
          {job.errorMessage ? ` — ${job.errorMessage}` : ""}
        </p>
      )}

      {summary ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                summary.isPublished
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              )}
            >
              {summary.isPublished ? "Publicado" : "Borrador"}
            </span>
            {summary.modelUsed && (
              <span className="text-xs text-text-secondary">
                Modelo: {summary.modelUsed}
              </span>
            )}
          </div>

          <pre className="whitespace-pre-wrap rounded-xl border border-border bg-surface-elevated/30 p-4 text-sm text-text-primary">
            {summary.content}
          </pre>

          {canManage && (
            <form action={publishAction} className="flex flex-wrap gap-2">
              {hiddenFields}
              <input
                type="hidden"
                name="publish"
                value={summary.isPublished ? "false" : "true"}
              />
              <SubmitButton pending={publishPending} className="w-auto">
                {summary.isPublished ? "Despublicar" : "Publicar resumen"}
              </SubmitButton>
            </form>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          Aún no hay resumen generado para esta jornada.
        </p>
      )}
    </Card>
  );
}
