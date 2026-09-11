"use client";

import { useState } from "react";
import {
  SEASON_FORMAT_OPTIONS,
  type CompetitionActionState,
} from "@/lib/competitions/types";
import {
  FORMAT_LOCKED_TOOLTIP,
  MATCH_DURATION_LOCKED_TOOLTIP,
} from "@/lib/competitions/season-edit-guards";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type CompetitionSetupFieldsProps = {
  pending?: boolean;
  state?: CompetitionActionState;
  defaultFormatType?: string;
  defaultMatchDurationMinutes?: number;
  showAdvanced?: boolean;
  formatLocked?: boolean;
  matchDurationLocked?: boolean;
  fieldPrefix?: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-danger" role="alert">
      {message}
    </p>
  );
}

export function CompetitionSetupFields({
  pending = false,
  state,
  defaultFormatType = "round_robin",
  defaultMatchDurationMinutes = 90,
  showAdvanced = true,
  formatLocked = false,
  matchDurationLocked = false,
}: CompetitionSetupFieldsProps) {
  const values = state?.values;
  const [formatType, setFormatType] = useState<string>(
    String(values?.formatType ?? defaultFormatType)
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="formatType" className="block text-sm font-medium">
            Formato
          </label>
          <select
            id="formatType"
            name="formatType"
            disabled={pending || formatLocked}
            value={formatType}
            onChange={(event) => setFormatType(event.target.value)}
            title={formatLocked ? FORMAT_LOCKED_TOOLTIP : undefined}
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              formatLocked && "cursor-not-allowed bg-surface text-text-secondary"
            )}
          >
            {SEASON_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {formatLocked && (
            <p className="text-xs text-muted">{FORMAT_LOCKED_TOOLTIP}</p>
          )}
          <FieldError message={state?.fieldErrors?.formatType} />
        </div>

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
            disabled={pending || matchDurationLocked}
            defaultValue={String(
              values?.matchDurationMinutes ?? defaultMatchDurationMinutes
            )}
            title={matchDurationLocked ? MATCH_DURATION_LOCKED_TOOLTIP : undefined}
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              matchDurationLocked &&
                "cursor-not-allowed bg-surface text-text-secondary"
            )}
          />
          {matchDurationLocked && (
            <p className="text-xs text-muted">{MATCH_DURATION_LOCKED_TOOLTIP}</p>
          )}
          <FieldError message={state?.fieldErrors?.matchDurationMinutes} />
        </div>
      </div>

      {formatType === "groups_knockout" && (
        <div className="space-y-1.5">
          <label
            htmlFor="groupsAdvancePerGroup"
            className="block text-sm font-medium"
          >
            Clasificados por grupo
          </label>
          <input
            id="groupsAdvancePerGroup"
            name="groupsAdvancePerGroup"
            type="number"
            min={1}
            disabled={pending || formatLocked}
            defaultValue={String(values?.groupsAdvancePerGroup ?? 2)}
            className="min-h-11 w-full max-w-xs rounded-xl border border-border bg-background px-3 text-sm"
          />
          <p className="text-xs text-text-secondary">
            Cuántos equipos de cada grupo avanzan a la eliminatoria.
          </p>
          <FieldError message={state?.fieldErrors?.groupsAdvancePerGroup} />
        </div>
      )}

      {showAdvanced && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={advancedOpen}
          >
            <SectionHeader
              title="Configuración avanzada"
              description="Puntos, descanso y disciplina. Valores estándar precargados."
            />
            <span className="shrink-0 text-sm font-medium text-brand">
              {advancedOpen ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {advancedOpen && (
            <>
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
                    defaultValue={String(values?.pointsWin ?? 3)}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <FieldError message={state?.fieldErrors?.pointsWin} />
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
                    defaultValue={String(values?.pointsDraw ?? 1)}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <FieldError message={state?.fieldErrors?.pointsDraw} />
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
                    defaultValue={String(values?.pointsLoss ?? 0)}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <FieldError message={state?.fieldErrors?.pointsLoss} />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  name="allowDraws"
                  disabled={pending}
                  defaultChecked={Boolean(values?.allowDraws ?? true)}
                />
                Permitir empates
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
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
                    defaultValue={String(values?.minimumRestMinutes ?? 0)}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <FieldError message={state?.fieldErrors?.minimumRestMinutes} />
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
                    defaultValue={String(values?.yellowCardLimit ?? 5)}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <FieldError message={state?.fieldErrors?.yellowCardLimit} />
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
                    defaultValue={String(values?.suspensionMatches ?? 1)}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <FieldError message={state?.fieldErrors?.suspensionMatches} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
