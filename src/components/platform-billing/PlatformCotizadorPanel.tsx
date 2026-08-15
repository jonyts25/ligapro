"use client";

import {
  useMemo,
  useState,
  type FocusEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Card } from "@/components/ui/Card";
import {
  calculateCotizacion,
  DEFAULT_COTIZADOR_INPUT,
  formatCotizadorMoney,
  type CotizadorInput,
  type PlayoffBracket,
} from "@/lib/platform-billing/cotizador";
import { downloadCotizadorPdf } from "@/lib/platform-billing/cotizador-pdf";
import { cn } from "@/lib/utils/cn";

const inputClassName =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-brand";

function selectInputValue(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.select();
}

function selectInputOnClick(event: MouseEvent<HTMLInputElement>) {
  event.currentTarget.select();
}

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

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onFocus" | "onClick"
>;

function NumericInput({ className, ...props }: NumericInputProps) {
  return (
    <input
      type="number"
      onFocus={selectInputValue}
      onClick={selectInputOnClick}
      className={cn(inputClassName, className)}
      {...props}
    />
  );
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
  const [input, setInput] = useState<CotizadorInput>(DEFAULT_COTIZADOR_INPUT);
  const [clientName, setClientName] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);

  const quote = useMemo(() => calculateCotizacion(input), [input]);

  function patch(patch: Partial<CotizadorInput>) {
    setInput((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Parámetros del torneo
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Precio por volumen de partidos/mes. El cálculo es efímero — no se
            guarda al recargar.
          </p>
        </div>

        <Field
          id="client-name"
          label="Nombre del cliente (opcional)"
          hint="Solo aparece en el PDF — no se vincula a ninguna organización."
        >
          <input
            id="client-name"
            type="text"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Ej. Liga Municipal XYZ"
            className={inputClassName}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="teams" label="Equipos">
            <NumericInput
              id="teams"
              min={2}
              step={1}
              value={input.teamCount}
              onChange={(event) =>
                patch({
                  teamCount: parsePositiveInt(event.target.value, input.teamCount),
                })
              }
            />
          </Field>

          <Field id="rounds" label="Vueltas (fase regular)">
            <select
              id="rounds"
              value={input.rounds}
              onChange={(event) =>
                patch({ rounds: Number(event.target.value) as 1 | 2 })
              }
              className={inputClassName}
            >
              <option value={1}>1 — una vuelta</option>
              <option value={2}>2 — ida y vuelta</option>
            </select>
          </Field>

          <Field id="playoff" label="Liguilla (clasificados)">
            <select
              id="playoff"
              value={input.playoffBracket}
              onChange={(event) =>
                patch({ playoffBracket: event.target.value as PlayoffBracket })
              }
              className={inputClassName}
            >
              <option value="none">Ninguna</option>
              <option value="top4">Top 4</option>
              <option value="top8">Top 8</option>
              <option value="top16">Top 16</option>
            </select>
          </Field>

          <Field id="months" label="Duración (meses)">
            <NumericInput
              id="months"
              min={1}
              step={1}
              value={input.durationMonths}
              onChange={(event) =>
                patch({
                  durationMonths: parsePositiveInt(
                    event.target.value,
                    input.durationMonths
                  ),
                })
              }
            />
          </Field>

          <Field id="court-cost" label="Costo de cancha reportado (MXN/partido)">
            <NumericInput
              id="court-cost"
              min={0}
              step={50}
              value={input.courtCostPerMatch}
              onChange={(event) =>
                patch({
                  courtCostPerMatch: parsePositiveFloat(
                    event.target.value,
                    input.courtCostPerMatch
                  ),
                })
              }
            />
          </Field>

          <Field
            id="portfolio"
            label="Torneos activos del organizador (ese mes)"
          >
            <NumericInput
              id="portfolio"
              min={1}
              max={10}
              step={1}
              value={input.activeTournaments}
              onChange={(event) =>
                patch({
                  activeTournaments: parsePositiveInt(
                    event.target.value,
                    input.activeTournaments
                  ),
                })
              }
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={input.thirdPlaceMatch}
            disabled={input.playoffBracket === "none"}
            onChange={(event) =>
              patch({ thirdPlaceMatch: event.target.checked })
            }
          />
          Partido por el tercer lugar (solo si liguilla ≥ top 4)
        </label>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">
            Resultado (cliente)
          </h2>
          {quote && (
            <button
              type="button"
              onClick={() =>
                downloadCotizadorPdf({
                  quote,
                  input,
                  clientName: clientName.trim() || undefined,
                })
              }
              className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Descargar PDF
            </button>
          )}
        </div>

        {quote ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-elevated/40 p-4">
                <p className="text-sm text-text-secondary">Precio mensual</p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {formatCotizadorMoney(quote.monthlyPrice)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-elevated/40 p-4">
                <p className="text-sm text-text-secondary">Precio temporada</p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {formatCotizadorMoney(quote.seasonPrice)}
                </p>
              </div>
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <p className="text-sm text-text-secondary">
                  Precio por equipo (temporada)
                </p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {formatCotizadorMoney(quote.pricePerTeamSeason)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInternalOpen((open) => !open)}
              className="text-sm font-medium text-brand"
              aria-expanded={internalOpen}
            >
              {internalOpen ? "Ocultar" : "Mostrar"} desglose interno (no mostrar
              al cliente)
            </button>

            {internalOpen && (
              <div className="rounded-xl border border-dashed border-border bg-surface-elevated/30 p-4 text-sm">
                <p className="mb-3 font-semibold text-text-primary">
                  No mostrar al cliente
                </p>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-text-secondary">Partidos regular</dt>
                    <dd className="font-medium">{quote.internal.regularMatches}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Partidos liguilla</dt>
                    <dd className="font-medium">{quote.internal.playoffMatches}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Total partidos</dt>
                    <dd className="font-medium">{quote.internal.totalMatches}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Partidos/mes</dt>
                    <dd className="font-medium">
                      {quote.internal.matchesPerMonth.toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Tier</dt>
                    <dd className="font-medium">
                      {quote.internal.tier} —{" "}
                      {formatCotizadorMoney(quote.internal.tierBasePrice)}/mes
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Banda cancha</dt>
                    <dd className="font-medium">
                      {quote.internal.courtBandLabel} (×
                      {quote.internal.courtMultiplier.toFixed(2)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Descuento portafolio</dt>
                    <dd className="font-medium">
                      {quote.internal.portfolioBandLabel} (
                      {(quote.internal.portfolioDiscountRate * 100).toFixed(0)}%)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Descuento en pesos</dt>
                    <dd className="font-medium">
                      −{formatCotizadorMoney(quote.internal.portfolioDiscountAmount)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Ingresa al menos 2 equipos para calcular.
          </p>
        )}
      </Card>
    </div>
  );
}
