"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addTeamCatchUpFixtureAction } from "@/lib/fixtures/actions";
import { initialFixtureActionState } from "@/lib/fixtures/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type CatchUpFixturePanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  teamLabel: string;
  eligible: boolean;
  message: string | null;
  opponentCount: number;
  pendingProgramMatchIds: string[];
  showOffer: boolean;
};

export function CatchUpFixturePanel({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  teamLabel,
  eligible,
  message,
  opponentCount,
  pendingProgramMatchIds,
  showOffer,
}: CatchUpFixturePanelProps) {
  const [state, formAction, pending] = useActionState(
    addTeamCatchUpFixtureAction,
    initialFixtureActionState
  );

  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  if (
    !showOffer &&
    pendingProgramMatchIds.length === 0 &&
    !state.ok &&
    !message
  ) {
    return null;
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          Partidos de alcance
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Genera los partidos que le faltan a{" "}
          <span className="font-medium text-text-primary">{teamLabel}</span>{" "}
          contra los {opponentCount} equipo{opponentCount === 1 ? "" : "s"} ya
          inscrito{opponentCount === 1 ? "" : "s"}. Los partidos existentes no
          se modifican.
        </p>
      </div>

      {(state.message || message) && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : eligible
                ? "border-warning/40 bg-warning/10 text-text-secondary"
                : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message || message}
        </p>
      )}

      {eligible && showOffer && !state.ok && (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
          <label className="flex items-start gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              name="confirmed"
              value="1"
              required
              disabled={pending}
              className="mt-1"
            />
            Confirmo generar los partidos de alcance para este equipo.
          </label>
          <SubmitButton pending={pending} className="w-auto">
            Generar partidos de alcance para este equipo
          </SubmitButton>
        </form>
      )}

      {(pendingProgramMatchIds.length > 0 || (state.ok && state.values?.generatedMatchIds)) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">
            Programar partidos pendientes
          </p>
          <ul className="space-y-2">
            {(state.values?.generatedMatchIds
              ? state.values.generatedMatchIds.split(",")
              : pendingProgramMatchIds
            ).map((matchId, index) => (
              <li key={matchId}>
                <Link
                  href={`${base}/partidos/${matchId}/programar`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent underline-offset-2 hover:underline"
                >
                  Programar partido {index + 1}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`${base}/calendario?jornada=${state.values?.catchUpRound ?? ""}`}
            className="inline-flex text-sm text-text-secondary underline"
          >
            Ver jornada de alcance en calendario
          </Link>
        </div>
      )}
    </Card>
  );
}
