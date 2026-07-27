"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import {
  DEFAULT_COTIZADOR_INPUTS,
  DEFAULT_COTIZADOR_PARAMS,
  calculateCotizacion,
  durationBandLabel,
  formatCotizadorMoney,
  type CotizadorInputs,
  type CotizadorParams,
  type DurationBand,
} from "@/lib/platform-billing/cotizador";
import { cn } from "@/lib/utils/cn";

const inputClassName =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-brand";

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parsePositiveFloat(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
};

function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}

export function PlatformCotizadorPanel() {
  const [inputs, setInputs] = useState<CotizadorInputs>(DEFAULT_COTIZADOR_INPUTS);
  const [params, setParams] = useState<CotizadorParams>(DEFAULT_COTIZADOR_PARAMS);
  const [paramsOpen, setParamsOpen] = useState(false);

  const result = useMemo(
    () => calculateCotizacion(inputs, params),
    [inputs, params]
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <h2 className="text-lg font-semibold text-text-primary">
          Escenario de cotización
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="team-count" label="Número de equipos">
            <input
              id="team-count"
              type="number"
              min={1}
              step={1}
              value={inputs.teamCount}
              onChange={(event) =>
                setInputs((prev) => ({
                  ...prev,
                  teamCount: parsePositiveInt(event.target.value, prev.teamCount),
                }))
              }
              className={inputClassName}
            />
          </Field>

          <Field
            id="duration-band"
            label="Duración del torneo"
            hint="Corta: ≤ 3 meses · Larga: > 3 y ≤ 6 meses"
          >
            <select
              id="duration-band"
              value={inputs.durationBand}
              onChange={(event) =>
                setInputs((prev) => ({
                  ...prev,
                  durationBand: event.target.value as DurationBand,
                }))
              }
              className={inputClassName}
            >
              <option value="corta">Corta (≤ 3 meses)</option>
              <option value="larga">Larga (&gt; 3 y ≤ 6 meses)</option>
            </select>
          </Field>

          <Field
            id="tournament-count"
            label="Torneos del cliente"
            hint="Define la banda de volumen (1–2, 3–5 o 6+)"
          >
            <input
              id="tournament-count"
              type="number"
              min={1}
              step={1}
              value={inputs.tournamentCount}
              onChange={(event) =>
                setInputs((prev) => ({
                  ...prev,
                  tournamentCount: parsePositiveInt(
                    event.target.value,
                    prev.tournamentCount
                  ),
                }))
              }
              className={inputClassName}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <button
          type="button"
          onClick={() => setParamsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={paramsOpen}
        >
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Parámetros de precio
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Ajustables para explorar escenarios — no se guardan al recargar.
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-brand">
            {paramsOpen ? "Ocultar" : "Mostrar"}
          </span>
        </button>

        {paramsOpen && (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              id="base-price"
              label="Precio base por equipo (MXN)"
            >
              <input
                id="base-price"
                type="number"
                min={0}
                step={1}
                value={params.basePricePerTeam}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    basePricePerTeam: parsePositiveFloat(
                      event.target.value,
                      prev.basePricePerTeam
                    ),
                  }))
                }
                className={inputClassName}
              />
            </Field>

            <Field
              id="dur-short"
              label="Multiplicador duración corta"
              hint="≤ 3 meses"
            >
              <input
                id="dur-short"
                type="number"
                min={0}
                step={0.01}
                value={params.durationMultiplierShort}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    durationMultiplierShort: parsePositiveFloat(
                      event.target.value,
                      prev.durationMultiplierShort
                    ),
                  }))
                }
                className={inputClassName}
              />
            </Field>

            <Field
              id="dur-long"
              label="Multiplicador duración larga"
              hint="> 3 y ≤ 6 meses"
            >
              <input
                id="dur-long"
                type="number"
                min={0}
                step={0.01}
                value={params.durationMultiplierLong}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    durationMultiplierLong: parsePositiveFloat(
                      event.target.value,
                      prev.durationMultiplierLong
                    ),
                  }))
                }
                className={inputClassName}
              />
            </Field>

            <Field id="vol-1-2" label="Multiplicador volumen 1–2 torneos">
              <input
                id="vol-1-2"
                type="number"
                min={0}
                step={0.01}
                value={params.volumeMultiplier1To2}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    volumeMultiplier1To2: parsePositiveFloat(
                      event.target.value,
                      prev.volumeMultiplier1To2
                    ),
                  }))
                }
                className={inputClassName}
              />
            </Field>

            <Field id="vol-3-5" label="Multiplicador volumen 3–5 torneos">
              <input
                id="vol-3-5"
                type="number"
                min={0}
                step={0.01}
                value={params.volumeMultiplier3To5}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    volumeMultiplier3To5: parsePositiveFloat(
                      event.target.value,
                      prev.volumeMultiplier3To5
                    ),
                  }))
                }
                className={inputClassName}
              />
            </Field>

            <Field id="vol-6-plus" label="Multiplicador volumen 6+ torneos">
              <input
                id="vol-6-plus"
                type="number"
                min={0}
                step={0.01}
                value={params.volumeMultiplier6Plus}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    volumeMultiplier6Plus: parsePositiveFloat(
                      event.target.value,
                      prev.volumeMultiplier6Plus
                    ),
                  }))
                }
                className={inputClassName}
              />
            </Field>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Resultado</h2>

        {result ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">Duración aplicada</dt>
                <dd className="font-medium text-text-primary">
                  {durationBandLabel(inputs.durationBand)} (×
                  {result.durationMultiplier.toFixed(2)})
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Banda de volumen</dt>
                <dd className="font-medium text-text-primary">
                  {result.volumeBand} (×{result.volumeMultiplier.toFixed(2)})
                </dd>
              </div>
            </dl>

            <div className="rounded-xl border border-border bg-surface-elevated p-4">
              <p className="text-sm text-text-secondary">Precio por torneo</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {formatCotizadorMoney(result.pricePerTournament)}
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                {formatCotizadorMoney(params.basePricePerTeam)} × {inputs.teamCount}{" "}
                equipos × {result.durationMultiplier.toFixed(2)} ×{" "}
                {result.volumeMultiplier.toFixed(2)}
              </p>
            </div>

            {inputs.tournamentCount > 1 && (
              <div
                className={cn(
                  "rounded-xl border border-brand/30 bg-brand/5 p-4"
                )}
              >
                <p className="text-sm text-text-secondary">
                  Total acumulado ({inputs.tournamentCount} torneos)
                </p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {formatCotizadorMoney(result.totalPrice)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Ingresa al menos un equipo y un torneo para ver el resultado.
          </p>
        )}
      </Card>
    </div>
  );
}
