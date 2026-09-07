"use client";

import { useMemo, useState } from "react";
import {
  getDuplicateJerseyWarnings,
  parseBulkPlayerLines,
} from "@/lib/teams/parse-bulk-players";
import { cn } from "@/lib/utils/cn";

type BulkPlayersPasteFieldProps = {
  id: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  required?: boolean;
};

export function BulkPlayersPasteField({
  id,
  name,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  disabled = false,
  rows = 8,
  required = false,
}: BulkPlayersPasteFieldProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;

  function handleChange(nextValue: string) {
    if (controlledValue === undefined) {
      setUncontrolledValue(nextValue);
    }
    onValueChange?.(nextValue);
  }

  const preview = useMemo(() => parseBulkPlayerLines(value), [value]);
  const duplicateWarnings = useMemo(
    () => getDuplicateJerseyWarnings(preview),
    [preview]
  );

  return (
    <div className="space-y-4">
      <p className="text-base text-text-primary">
        Escribe un nombre de jugador por renglón. Si quieres ponerle número de
        camiseta, agrégalo después del nombre separado por una coma. Si no le
        pones número, se lo asignamos nosotros en orden.
      </p>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
        <p className="mb-2 font-medium text-text-primary">Ejemplo</p>
        <pre className="whitespace-pre-wrap font-mono text-text-secondary">
{`Juan Pérez, 10
María López
Carlos Ruiz, 7`}
        </pre>
        <p className="mt-2 text-muted">
          Juan Pérez usará el 10, María López no puso número (se le asigna uno
          solo), Carlos Ruiz usará el 7.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium">
          Lista de jugadores
        </label>
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          required={required}
          rows={rows}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm",
            duplicateWarnings.length > 0 && "border-warning"
          )}
        />
      </div>

      {preview.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-background px-4 py-3 text-sm">
          <p className="font-medium">
            Se van a crear {preview.length} jugador
            {preview.length === 1 ? "" : "es"}:
          </p>
          <ul className="space-y-1 text-text-secondary">
            {preview.map((player) => (
              <li key={`${player.fullName}-${player.finalJersey}`}>
                {player.fullName} — dorsal {player.finalJersey}
                {player.autoAssigned ? " (asignado automáticamente)" : ""}
              </li>
            ))}
          </ul>
          {duplicateWarnings.map((warning) => (
            <p key={warning} className="text-warning" role="alert">
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function useBulkPlayersPasteValidation(value: string): {
  preview: ReturnType<typeof parseBulkPlayerLines>;
  duplicateWarnings: string[];
  canSubmit: boolean;
} {
  const preview = useMemo(() => parseBulkPlayerLines(value), [value]);
  const duplicateWarnings = useMemo(
    () => getDuplicateJerseyWarnings(preview),
    [preview]
  );

  return {
    preview,
    duplicateWarnings,
    canSubmit: preview.length > 0 && duplicateWarnings.length === 0,
  };
}
