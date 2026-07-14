"use client";

import { useActionState } from "react";
import { updateMatchResultAction } from "@/lib/matches/actions";
import {
  allowedStatusTransitions,
  initialCaptureActionState,
  matchStatusLabel,
  type MatchStatusValue,
} from "@/lib/matches/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type MatchScoreFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  currentStatus: MatchStatusValue;
  homeScore: number | null;
  awayScore: number | null;
  homeName: string;
  awayName: string;
  canUpdate: boolean;
};

export function MatchScoreForm({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  currentStatus,
  homeScore,
  awayScore,
  homeName,
  awayName,
  canUpdate,
}: MatchScoreFormProps) {
  const [state, action, pending] = useActionState(
    updateMatchResultAction,
    initialCaptureActionState
  );

  if (!canUpdate) return null;

  const statuses = allowedStatusTransitions(currentStatus);

  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold">Marcador oficial</h2>
      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
        >
          {state.message}
        </p>
      )}
      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="matchId" value={matchId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="homeScore" className="text-sm font-medium">
              {homeName}
            </label>
            <input
              id="homeScore"
              name="homeScore"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={
                state.values?.homeScore ?? homeScore ?? 0
              }
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="awayScore" className="text-sm font-medium">
              {awayName}
            </label>
            <input
              id="awayScore"
              name="awayScore"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={
                state.values?.awayScore ?? awayScore ?? 0
              }
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={String(state.values?.status ?? currentStatus)}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {matchStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pending={pending}>Guardar marcador</SubmitButton>
      </form>
    </Card>
  );
}
