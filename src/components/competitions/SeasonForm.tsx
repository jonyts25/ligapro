"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createSeasonAction,
  updateSeasonAction,
} from "@/lib/competitions/actions";
import {
  SEASON_FORMAT_OPTIONS,
  SEASON_VISIBILITY_OPTIONS,
  initialCompetitionActionState,
  type SeasonDetail,
} from "@/lib/competitions/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type SeasonFormProps = {
  organizationId: string;
  competitionId: string;
  mode: "create" | "edit";
  season?: SeasonDetail;
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
  mode,
  season,
}: SeasonFormProps) {
  const action = mode === "create" ? createSeasonAction : updateSeasonAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialCompetitionActionState
  );

  const v = state.values;
  const rules = season?.rules;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      {mode === "edit" && season && (
        <input type="hidden" name="seasonId" value={season.id} />
      )}

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
          title="Información de temporada"
          description="Nombre, formato, estado y fechas."
        />
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
            defaultValue={String(v?.name ?? season?.name ?? "")}
            placeholder="Apertura 2026"
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            )}
          />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="formatType" className="block text-sm font-medium">
              Formato
            </label>
            <select
              id="formatType"
              name="formatType"
              disabled={pending}
              defaultValue={String(
                v?.formatType ?? season?.format_type ?? "round_robin"
              )}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {SEASON_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.formatType} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="visibility" className="block text-sm font-medium">
              Estado
            </label>
            <select
              id="visibility"
              name="visibility"
              disabled={pending}
              defaultValue={String(
                v?.visibility ?? season?.visibility ?? "draft"
              )}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {SEASON_VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.visibility} />
          </div>
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
              defaultValue={String(v?.startsOn ?? season?.starts_on ?? "")}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
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
              defaultValue={String(v?.endsOn ?? season?.ends_on ?? "")}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.endsOn} />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionHeader
          title="Reglas deportivas"
          description="Puntos, disciplina y duración. Se guarda una sola configuración por temporada."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="pointsWin" className="block text-sm font-medium">
              Puntos por victoria
            </label>
            <input
              id="pointsWin"
              name="pointsWin"
              type="number"
              min={0}
              disabled={pending}
              defaultValue={String(v?.pointsWin ?? rules?.points_win ?? 3)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.pointsWin} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pointsDraw" className="block text-sm font-medium">
              Puntos por empate
            </label>
            <input
              id="pointsDraw"
              name="pointsDraw"
              type="number"
              min={0}
              disabled={pending}
              defaultValue={String(v?.pointsDraw ?? rules?.points_draw ?? 1)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.pointsDraw} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pointsLoss" className="block text-sm font-medium">
              Puntos por derrota
            </label>
            <input
              id="pointsLoss"
              name="pointsLoss"
              type="number"
              min={0}
              disabled={pending}
              defaultValue={String(v?.pointsLoss ?? rules?.points_loss ?? 0)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.pointsLoss} />
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="allowDraws"
            disabled={pending}
            defaultChecked={Boolean(
              v?.allowDraws ?? rules?.allow_draws ?? true
            )}
          />
          Permitir empates
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="matchDurationMinutes"
              className="block text-sm font-medium"
            >
              Duración del partido (minutos)
            </label>
            <input
              id="matchDurationMinutes"
              name="matchDurationMinutes"
              type="number"
              min={1}
              disabled={pending}
              defaultValue={String(
                v?.matchDurationMinutes ?? rules?.match_duration_minutes ?? 90
              )}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.matchDurationMinutes} />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="minimumRestMinutes"
              className="block text-sm font-medium"
            >
              Descanso mínimo entre partidos (minutos)
            </label>
            <input
              id="minimumRestMinutes"
              name="minimumRestMinutes"
              type="number"
              min={0}
              disabled={pending}
              defaultValue={String(
                v?.minimumRestMinutes ?? rules?.minimum_rest_minutes ?? 0
              )}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.minimumRestMinutes} />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="yellowCardLimit"
              className="block text-sm font-medium"
            >
              Límite de amarillas para suspensión
            </label>
            <input
              id="yellowCardLimit"
              name="yellowCardLimit"
              type="number"
              min={1}
              disabled={pending}
              defaultValue={String(
                v?.yellowCardLimit ?? rules?.yellow_card_limit ?? 5
              )}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.yellowCardLimit} />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="suspensionMatches"
              className="block text-sm font-medium"
            >
              Partidos de suspensión
            </label>
            <input
              id="suspensionMatches"
              name="suspensionMatches"
              type="number"
              min={1}
              disabled={pending}
              defaultValue={String(
                v?.suspensionMatches ?? rules?.suspension_matches ?? 1
              )}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            <FieldError message={state.fieldErrors?.suspensionMatches} />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={pending}>
          {mode === "create" ? "Crear temporada" : "Guardar cambios"}
        </SubmitButton>
        <Link
          href={
            mode === "edit" && season
              ? `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${season.id}`
              : `/organizaciones/${organizationId}/torneos/${competitionId}`
          }
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
