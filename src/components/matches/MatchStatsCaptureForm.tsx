"use client";

import { useActionState } from "react";
import {
  initialMatchStatsActionState,
  saveMatchStatsAction,
} from "@/lib/match-stats/actions";
import type { MatchStatsCaptureContext } from "@/lib/match-stats/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type MatchStatsCaptureFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  data: MatchStatsCaptureContext;
};

function TeamStatsFields({
  prefix,
  team,
  disabled,
}: {
  prefix: "home" | "away";
  team: MatchStatsCaptureContext["home"];
  disabled: boolean;
}) {
  const labelPrefix = prefix === "home" ? "home" : "away";
  const fields = [
    { name: `${labelPrefix}Shots`, label: "Tiros", value: team.shots },
    {
      name: `${labelPrefix}ShotsOnTarget`,
      label: "Tiros a arco",
      value: team.shotsOnTarget,
    },
    {
      name: `${labelPrefix}PossessionPct`,
      label: "Posesión %",
      value: team.possessionPct,
      step: "0.1",
      max: 100,
    },
    { name: `${labelPrefix}Corners`, label: "Corners", value: team.corners },
    { name: `${labelPrefix}Fouls`, label: "Faltas", value: team.fouls },
    { name: `${labelPrefix}Offsides`, label: "Offsides", value: team.offsides },
  ] as const;

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-semibold">{team.teamName}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1">
            <label htmlFor={field.name} className="text-xs font-medium text-muted">
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              type="number"
              min={0}
              max={"max" in field ? field.max : undefined}
              step={"step" in field ? field.step : 1}
              defaultValue={field.value ?? ""}
              className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function MatchStatsCaptureForm({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  data,
}: MatchStatsCaptureFormProps) {
  const [state, action, pending] = useActionState(
    saveMatchStatsAction,
    initialMatchStatsActionState
  );

  return (
    <Card className="space-y-6 p-4">
      <SectionHeader
        title="Estadísticas del partido"
        description="Opcional. Completa después del partido para enriquecer crónicas con IA."
      />

      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}

      {!data.canEdit ? (
        <p className="text-sm text-muted">
          No tienes permiso para editar estadísticas de este partido.
        </p>
      ) : (
        <form action={action} className="space-y-6">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="matchId" value={matchId} />
          <input
            type="hidden"
            name="homeSeasonTeamId"
            value={data.home.seasonTeamId}
          />
          <input
            type="hidden"
            name="awaySeasonTeamId"
            value={data.away.seasonTeamId}
          />

          <TeamStatsFields prefix="home" team={data.home} disabled={pending} />
          <TeamStatsFields prefix="away" team={data.away} disabled={pending} />

          <fieldset className="space-y-3" disabled={pending}>
            <legend className="text-sm font-semibold">Contexto</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="attendance" className="text-xs font-medium text-muted">
                  Asistencia
                </label>
                <input
                  id="attendance"
                  name="attendance"
                  type="number"
                  min={0}
                  defaultValue={data.context.attendance ?? ""}
                  className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="weather" className="text-xs font-medium text-muted">
                  Clima
                </label>
                <input
                  id="weather"
                  name="weather"
                  type="text"
                  maxLength={120}
                  defaultValue={data.context.weather ?? ""}
                  className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="refereeName" className="text-xs font-medium text-muted">
                  Árbitro
                </label>
                <input
                  id="refereeName"
                  name="refereeName"
                  type="text"
                  maxLength={120}
                  defaultValue={data.context.refereeName ?? ""}
                  className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label
                  htmlFor="highlightNote"
                  className="text-xs font-medium text-muted"
                >
                  Nota destacada
                </label>
                <textarea
                  id="highlightNote"
                  name="highlightNote"
                  rows={3}
                  maxLength={500}
                  defaultValue={data.context.highlightNote ?? ""}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </fieldset>

          <SubmitButton pending={pending} className="w-auto px-4">
            Guardar estadísticas
          </SubmitButton>
        </form>
      )}
    </Card>
  );
}
