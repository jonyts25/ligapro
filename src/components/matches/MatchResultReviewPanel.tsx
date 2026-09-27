"use client";

import { useActionState } from "react";
import {
  approveMatchResultAction,
  openMatchResultDisputeAction,
} from "@/lib/matches/result-review";
import { formatAutoCloseLabel } from "@/lib/matches/result-review-validation";
import type { MatchResultReviewStatus } from "@/lib/matches/result-review-types";
import {
  initialCaptureActionState,
} from "@/lib/matches/types";
import { captureErrorAlertClass } from "@/lib/matches/capture-errors";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";

type MatchResultReviewPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  review: MatchResultReviewStatus;
};

export function MatchResultReviewPanel({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  review,
}: MatchResultReviewPanelProps) {
  const [disputeState, disputeAction, disputePending] = useActionState(
    openMatchResultDisputeAction,
    initialCaptureActionState
  );
  const [approveState, approveAction, approvePending] = useActionState(
    approveMatchResultAction,
    initialCaptureActionState
  );
  const autoCloseLabel = formatAutoCloseLabel(review.autoCloseAt);

  if (review.phase === "not_applicable") return null;

  const hidden = [
    { name: "organizationId", value: organizationId },
    { name: "competitionId", value: competitionId },
    { name: "seasonId", value: seasonId },
    { name: "matchId", value: matchId },
  ];

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {review.phase === "approved" ? (
          <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
            Resultado aprobado
          </span>
        ) : (
          <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
            Pendiente de aprobación
          </span>
        )}
        {review.phase !== "approved" && autoCloseLabel && (
          <span className="text-xs text-text-secondary">
            Autocierre: {autoCloseLabel}
          </span>
        )}
      </div>

      {review.openDispute && (
        <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <p className="font-medium text-text-primary">Disputa abierta</p>
          <p className="mt-1 text-text-secondary">
            {review.openDispute.openedByDisplayName}: {review.openDispute.reason}
          </p>
        </div>
      )}

      {disputeState.message && (
        <p
          className={
            disputeState.ok
              ? "rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              : captureErrorAlertClass(disputeState.errorKind ?? "generic")
          }
        >
          {disputeState.message}
        </p>
      )}
      {approveState.message && (
        <p
          className={
            approveState.ok
              ? "rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              : captureErrorAlertClass(approveState.errorKind ?? "generic")
          }
        >
          {approveState.message}
        </p>
      )}

      {review.canOpenDispute && (
        <form action={disputeAction} className="space-y-2">
          {hidden.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ))}
          <label htmlFor="dispute-reason" className="block text-sm font-medium">
            Motivo de la disputa
          </label>
          <textarea
            id="dispute-reason"
            name="reason"
            required
            rows={3}
            className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="Describe por qué disputas el resultado"
          />
          <SubmitButton pending={disputePending}>Abrir disputa</SubmitButton>
        </form>
      )}

      {review.canApproveResult && review.phase !== "approved" && (
        <form action={approveAction}>
          {hidden.map((field) => (
            <input key={`approve-${field.name}`} type="hidden" name={field.name} value={field.value} />
          ))}
          <SubmitButton pending={approvePending}>Aprobar resultado</SubmitButton>
        </form>
      )}
    </Card>
  );
}
