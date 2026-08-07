"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enqueueChronicleAction,
  refreshChroniclePanelAction,
  setChroniclePublishedAction,
} from "@/lib/chronicles/actions";
import {
  initialChronicleActionState,
  type MatchChronicleJobRow,
  type MatchChronicleRow,
} from "@/lib/chronicles/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type MatchChroniclePanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  matchFinished: boolean;
  canManage: boolean;
  chronicle: MatchChronicleRow | null;
  job: MatchChronicleJobRow | null;
};

const JOB_STATUS_LABEL: Record<MatchChronicleJobRow["status"], string> = {
  pending: "En cola",
  processing: "Procesando",
  done: "Completado",
  error: "Error",
};

function jobStatusVariant(
  status: MatchChronicleJobRow["status"]
): "default" | "warning" | "success" | "danger" {
  switch (status) {
    case "pending":
    case "processing":
      return "warning";
    case "done":
      return "success";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

export function MatchChroniclePanel({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  matchFinished,
  canManage,
  chronicle,
  job,
}: MatchChroniclePanelProps) {
  const router = useRouter();
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [enqueueState, enqueueAction, enqueuePending] = useActionState(
    enqueueChronicleAction,
    initialChronicleActionState
  );
  const [publishState, publishAction, publishPending] = useActionState(
    setChroniclePublishedAction,
    initialChronicleActionState
  );
  const [, refreshAction, refreshPending] = useActionState(
    refreshChroniclePanelAction,
    initialChronicleActionState
  );

  if (!matchFinished) {
    return null;
  }

  const hiddenFields = (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="matchId" value={matchId} />
    </>
  );

  const needsConfirm =
    enqueueState.needsConfirm ||
    (chronicle?.isPublished && !confirmRegenerate);

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          Crónica del partido
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          La generación es asíncrona: el worker local procesa la cola cuando
          está activo. Revisa el texto antes de publicar — el modelo puede
          equivocarse aunque el marcador esté en el prompt.
        </p>
      </div>

      {canManage && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-elevated/40 p-4">
          {(needsConfirm || enqueueState.needsConfirm) && !confirmRegenerate && (
            <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-primary">
              Ya hay una crónica publicada para este partido. Generar una nueva
              la reemplazará y quedará sin publicar hasta que la revises.
            </p>
          )}

          {chronicle?.isPublished && !confirmRegenerate ? (
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground hover:opacity-90 sm:w-auto"
              onClick={() => setConfirmRegenerate(true)}
            >
              Generar crónica
            </button>
          ) : (
            <form action={enqueueAction} className="space-y-3">
              {hiddenFields}
              {confirmRegenerate && (
                <input type="hidden" name="confirmRegenerate" value="true" />
              )}
              <SubmitButton pending={enqueuePending} className="w-full sm:w-auto">
                {confirmRegenerate
                  ? "Confirmar y generar crónica"
                  : "Generar crónica"}
              </SubmitButton>
            </form>
          )}

          {job && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-text-secondary">Estado del job:</span>
                <span
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-xs font-medium",
                    jobStatusVariant(job.status) === "warning" &&
                      "bg-warning/15 text-warning",
                    jobStatusVariant(job.status) === "success" &&
                      "bg-success/15 text-success",
                    jobStatusVariant(job.status) === "danger" &&
                      "bg-danger/15 text-danger",
                    jobStatusVariant(job.status) === "default" &&
                      "bg-surface-elevated text-text-secondary"
                  )}
                >
                  {JOB_STATUS_LABEL[job.status]}
                </span>
                <span className="text-xs text-muted">
                  {new Date(job.createdAt).toLocaleString("es-MX")}
                </span>
              </div>
              {job.errorMessage && (
                <p className="text-sm text-danger">{job.errorMessage}</p>
              )}
            </div>
          )}

          <form
            action={refreshAction}
            onSubmit={() => {
              queueMicrotask(() => router.refresh());
            }}
          >
            {hiddenFields}
            <SubmitButton
              pending={refreshPending}
              className="w-full bg-surface-elevated text-text-primary ring-1 ring-border hover:opacity-100 sm:w-auto"
            >
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
            >
              {enqueueState.message ?? publishState.message}
            </p>
          )}
        </div>
      )}

      {chronicle ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-secondary">
              Generada{" "}
              {new Date(chronicle.generatedAt).toLocaleString("es-MX")}
              {chronicle.modelUsed ? ` · ${chronicle.modelUsed}` : ""}
            </p>
            <span
              className={cn(
                "rounded-lg px-2 py-0.5 text-xs font-medium",
                chronicle.isPublished
                  ? "bg-success/15 text-success"
                  : "bg-surface-elevated text-text-secondary"
              )}
            >
              {chronicle.isPublished ? "Publicada" : "Sin publicar"}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-4 text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
            {chronicle.content}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <form action={publishAction}>
                {hiddenFields}
                <input
                  type="hidden"
                  name="publish"
                  value={chronicle.isPublished ? "false" : "true"}
                />
                <SubmitButton
                  pending={publishPending}
                  className="bg-surface-elevated text-text-primary ring-1 ring-border hover:opacity-100"
                >
                  {chronicle.isPublished ? "Despublicar" : "Publicar"}
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          {canManage
            ? "Aún no hay crónica generada para este partido."
            : "La crónica aparecerá aquí cuando exista y esté publicada."}
        </p>
      )}
    </Card>
  );
}
