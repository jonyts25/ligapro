"use client";

import { useActionState } from "react";
import Link from "next/link";
import { formatLabel } from "@/lib/competitions/types";
import { wizardGenerateFixtureAction } from "@/lib/tournament-wizard/actions";
import { initialTournamentWizardActionState } from "@/lib/tournament-wizard/types";
import { estimateTournamentPlan } from "@/lib/tournament-wizard/simulator";
import type { SeasonFormatType } from "@/lib/competitions/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type TournamentWizardGenerateStepProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  competitionName: string;
  teamCount: number;
  formatType: SeasonFormatType;
  fieldsCount: number;
  groupsAdvancePerGroup: number | null;
  canGenerate: boolean;
  fixtureGenerated: boolean;
};

export function TournamentWizardGenerateStep({
  organizationId,
  competitionId,
  seasonId,
  competitionName,
  teamCount,
  formatType,
  fieldsCount,
  groupsAdvancePerGroup,
  canGenerate,
  fixtureGenerated,
}: TournamentWizardGenerateStepProps) {
  const [state, formAction, pending] = useActionState(
    wizardGenerateFixtureAction,
    initialTournamentWizardActionState
  );

  const plan = estimateTournamentPlan({
    teamCount,
    formatType,
    fieldsCount,
    groupsAdvancePerGroup,
  });

  if (fixtureGenerated) {
    return (
      <Card className="space-y-4">
        <p className="text-base text-text-primary">
          El fixture de {competitionName} ya está generado.
        </p>
        <Link
          href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/calendario`}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Ver calendario
        </Link>
      </Card>
    );
  }

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
        Listo para generar el fixture de {competitionName} con {teamCount} equipos
        ({formatLabel(formatType).toLowerCase()}).
      </p>

      {plan && (
        <div className="mb-4 space-y-2 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium text-text-primary">
            {plan.isApproximate ? "Serán aproximadamente" : "Serán"}{" "}
            {plan.totalMatches} partidos, a un ritmo de {plan.matchesPerWeek} por
            semana con las canchas elegidas: listo en ~{plan.estimatedWeeks}{" "}
            semanas.
          </p>
          <p className="text-xs text-text-secondary">{plan.formula}</p>
          {plan.isApproximate && (
            <p className="text-xs text-text-secondary">
              Estimado — depende de cómo armes los grupos.
            </p>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />

        <div className="flex flex-wrap gap-3">
          <SubmitButton
            pending={pending}
            className="w-auto"
            disabled={!canGenerate}
          >
            Generar mi torneo
          </SubmitButton>
          <Link
            href={`/organizaciones/${organizationId}/torneos/asistente/${competitionId}/${seasonId}/horarios`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        </div>
      </form>
    </Card>
  );
}
