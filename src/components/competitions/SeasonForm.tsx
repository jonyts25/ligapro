"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateSeasonAction } from "@/lib/competitions/actions";
import {
  initialCompetitionActionState,
  type SeasonDetail,
} from "@/lib/competitions/types";
import {
  SEASON_FORM_VISIBILITY_OPTIONS,
  formVisibilityHiddenValue,
  isSeasonPubliclyVisible,
} from "@/lib/competitions/season-visibility";
import {
  isSeasonFormatLocked,
  isSeasonMatchDurationLocked,
} from "@/lib/competitions/season-edit-guards";
import { CompetitionSetupFields } from "@/components/competitions/CompetitionSetupFields";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type SeasonFormProps = {
  organizationId: string;
  competitionId: string;
  season: SeasonDetail;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-danger" role="alert">
      {message}
    </p>
  );
}

export function SeasonForm({
  organizationId,
  competitionId,
  season,
}: SeasonFormProps) {
  const [state, formAction, pending] = useActionState(
    updateSeasonAction,
    initialCompetitionActionState
  );

  const v = state.values;
  const rules = season.rules;
  const hiddenVisibility = formVisibilityHiddenValue(season);
  const isPublicEdit = isSeasonPubliclyVisible(season.visibility);
  const formatLocked = isSeasonFormatLocked(season);
  const matchDurationLocked = isSeasonMatchDurationLocked(season);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={season.id} />
      <input type="hidden" name="visibility" value={hiddenVisibility} />
      <input
        type="hidden"
        name="name"
        value={String(v?.name ?? season.name)}
      />

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

      <Card className="space-y-4">
        <SectionHeader
          title="Configuración del torneo"
          description="Formato, duración de partido, estado y fechas."
        />
        <CompetitionSetupFields
          pending={pending}
          state={state}
          defaultFormatType={season.format_type}
          defaultMatchDurationMinutes={rules.match_duration_minutes}
          formatLocked={formatLocked}
          matchDurationLocked={matchDurationLocked}
        />
        <div className="space-y-1.5">
          <label htmlFor="visibility" className="block text-sm font-medium">
            Estado
          </label>
          {isPublicEdit ? (
            <p
              id="visibility"
              className="min-h-11 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            >
              Pública — usa «Archivar» o la página del torneo para retirarla del
              público.
            </p>
          ) : (
            <select
              id="visibility"
              disabled
              value={SEASON_FORM_VISIBILITY_OPTIONS[0]?.value ?? "draft"}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text-secondary"
            >
              {SEASON_FORM_VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <FieldError message={state.fieldErrors?.visibility} />
          <p className="text-xs text-text-secondary">
            Para hacerlo público usa el botón «Publicar» en la página del torneo.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="startsOn" className="block text-sm font-medium">
              Fecha de inicio
            </label>
            <input
              id="startsOn"
              name="startsOn"
              type="date"
              disabled={pending}
              defaultValue={String(v?.startsOn ?? season.starts_on ?? "")}
              className={cn(
                "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              )}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="endsOn" className="block text-sm font-medium">
              Fecha de fin
            </label>
            <input
              id="endsOn"
              name="endsOn"
              type="date"
              disabled={pending}
              defaultValue={String(v?.endsOn ?? season.ends_on ?? "")}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.endsOn} />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={pending}>Guardar cambios</SubmitButton>
        <Link
          href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${season.id}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
