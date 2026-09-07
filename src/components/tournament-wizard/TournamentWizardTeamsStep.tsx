"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { wizardAddTeamsAction } from "@/lib/tournament-wizard/actions";
import { parseBulkTeamNames } from "@/lib/teams/parse-bulk-players";
import { initialTournamentWizardActionState } from "@/lib/tournament-wizard/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type TournamentWizardTeamsStepProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  suggestedTeamCount?: number;
};

export function TournamentWizardTeamsStep({
  organizationId,
  competitionId,
  seasonId,
  suggestedTeamCount = 4,
}: TournamentWizardTeamsStepProps) {
  const [state, formAction, pending] = useActionState(
    wizardAddTeamsAction,
    initialTournamentWizardActionState
  );
  const [bulkList, setBulkList] = useState("");

  const teamNames = useMemo(() => parseBulkTeamNames(bulkList), [bulkList]);
  const canContinue = teamNames.length >= 2;

  return (
    <Card>
      {state.message && (
        <p
          className={cn(
            "mb-4 rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}

      <p className="mb-4 text-base text-text-primary">
        Escribe un nombre de equipo por renglón. No uses comas ni dorsales — solo
        el nombre de cada equipo.
      </p>

      <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
        <p className="mb-2 font-medium">Ejemplo</p>
        <pre className="whitespace-pre-wrap font-mono text-text-secondary">
{`Halcones FC
Leones SC
Tigres United`}
        </pre>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />

        <div className="space-y-1.5">
          <label htmlFor="bulkList" className="block text-sm font-medium">
            Equipos
          </label>
          <textarea
            id="bulkList"
            name="bulkList"
            required
            rows={Math.max(6, suggestedTeamCount + 1)}
            disabled={pending}
            value={bulkList}
            onChange={(event) => setBulkList(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {teamNames.length > 0 && (
          <p className="text-sm text-text-secondary">
            {teamNames.length} equipo{teamNames.length === 1 ? "" : "s"} listo
            {teamNames.length === 1 ? "" : "s"}
            {canContinue ? "" : " — necesitas al menos 2"}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <SubmitButton
            pending={pending}
            className="w-auto"
            disabled={!canContinue}
          >
            Continuar
          </SubmitButton>
          <Link
            href={`/organizaciones/${organizationId}/torneos/asistente`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        </div>
      </form>
    </Card>
  );
}
