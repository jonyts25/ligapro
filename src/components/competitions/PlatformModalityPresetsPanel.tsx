"use client";

import { useActionState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { saveTournamentTypePresetAction } from "@/lib/competitions/modality-presets-actions";
import {
  initialModalityPresetActionState,
  type TournamentTypePreset,
} from "@/lib/competitions/tournament-type-presets";
import { cn } from "@/lib/utils/cn";

const inputClassName =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-brand";

type FieldProps = {
  id: string;
  label: string;
  children: ReactNode;
};

function Field({ id, label, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
      </label>
      {children}
    </div>
  );
}

type PresetFormProps = {
  preset: TournamentTypePreset;
  actionState: typeof initialModalityPresetActionState;
  formAction: (payload: FormData) => void;
  pending: boolean;
};

function PresetForm({ preset, actionState, formAction, pending }: PresetFormProps) {
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="modality" value={preset.modality} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-text-primary">{preset.label}</h3>
        <p className="text-xs text-text-secondary">
          Código: <code>{preset.modality}</code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id={`${preset.modality}-label`} label="Nombre para mostrar">
          <input
            id={`${preset.modality}-label`}
            name="label"
            type="text"
            required
            defaultValue={preset.label}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-players`} label="Jugadores en cancha">
          <input
            id={`${preset.modality}-players`}
            name="playersOnField"
            type="number"
            min={1}
            required
            defaultValue={preset.playersOnField}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-halves`} label="Tiempos">
          <input
            id={`${preset.modality}-halves`}
            name="halvesCount"
            type="number"
            min={1}
            required
            defaultValue={preset.halvesCount}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-duration`} label="Duración (min)">
          <input
            id={`${preset.modality}-duration`}
            name="matchDurationMinutes"
            type="number"
            min={1}
            required
            defaultValue={preset.matchDurationMinutes}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-min-roster`} label="Plantel mínimo">
          <input
            id={`${preset.modality}-min-roster`}
            name="minRosterSize"
            type="number"
            min={1}
            defaultValue={preset.minRosterSize ?? ""}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-max-roster`} label="Plantel máximo">
          <input
            id={`${preset.modality}-max-roster`}
            name="maxRosterSize"
            type="number"
            min={1}
            defaultValue={preset.maxRosterSize ?? ""}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-points-win`} label="Puntos victoria">
          <input
            id={`${preset.modality}-points-win`}
            name="pointsWin"
            type="number"
            min={0}
            required
            defaultValue={preset.pointsWin}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-points-draw`} label="Puntos empate">
          <input
            id={`${preset.modality}-points-draw`}
            name="pointsDraw"
            type="number"
            min={0}
            required
            defaultValue={preset.pointsDraw}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-points-loss`} label="Puntos derrota">
          <input
            id={`${preset.modality}-points-loss`}
            name="pointsLoss"
            type="number"
            min={0}
            required
            defaultValue={preset.pointsLoss}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-rest`} label="Descanso mínimo (min)">
          <input
            id={`${preset.modality}-rest`}
            name="minimumRestMinutes"
            type="number"
            min={0}
            required
            defaultValue={preset.minimumRestMinutes}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-yellow`} label="Límite amarillas">
          <input
            id={`${preset.modality}-yellow`}
            name="yellowCardLimit"
            type="number"
            min={1}
            required
            defaultValue={preset.yellowCardLimit}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
        <Field id={`${preset.modality}-suspension`} label="Partidos suspensión">
          <input
            id={`${preset.modality}-suspension`}
            name="suspensionMatches"
            type="number"
            min={1}
            required
            defaultValue={preset.suspensionMatches}
            disabled={pending}
            className={inputClassName}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm text-text-secondary">
        <input
          type="checkbox"
          name="allowDraws"
          defaultChecked={preset.allowDraws}
          disabled={pending}
        />
        Permitir empates
      </label>

      <SubmitButton pending={pending} className="w-auto px-4">
        Guardar {preset.label}
      </SubmitButton>

      {actionState.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            actionState.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={actionState.ok ? "status" : "alert"}
        >
          {actionState.message}
        </p>
      )}
    </form>
  );
}

type PlatformModalityPresetsPanelProps = {
  presets: TournamentTypePreset[];
};

export function PlatformModalityPresetsPanel({
  presets,
}: PlatformModalityPresetsPanelProps) {
  const [actionState, formAction, pending] = useActionState(
    saveTournamentTypePresetAction,
    initialModalityPresetActionState
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">
          Plantillas por modalidad
        </h2>
        <p className="text-sm text-text-secondary">
          Estos valores precargan el formulario de reglas al crear un torneo.
          Los organizadores pueden editarlos antes de guardar.
        </p>
      </Card>

      {presets.map((preset) => (
        <Card key={preset.modality}>
          <PresetForm
            preset={preset}
            actionState={actionState}
            formAction={formAction}
            pending={pending}
          />
        </Card>
      ))}
    </div>
  );
}
