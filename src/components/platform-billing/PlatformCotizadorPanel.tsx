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
  type CotizadorPricingParams,
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

type PlatformCotizadorPanelProps = {
  pricing: CotizadorPricingParams;
};

export function PlatformCotizadorPanel({ pricing }: PlatformCotizadorPanelProps) {
  const [input, setInput] = useState<CotizadorInput>(DEFAULT_COTIZADOR_INPUT);
  const [clientName, setClientName] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);

  const quote = useMemo(
    () => calculateCotizacion(input, pricing),
    [input, pricing]
  );

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
            Precio por torneo + equipos inscritos (sin mensualidad). Tarifas
            base: {formatCotizadorMoney(pricing.basePricePerTournament)} / torneo
            + {formatCotizadorMoney(pricing.basePricePerTeam)} / equipo.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="teams" label="Equipos inscritos">
            <NumericInput
              id="teams"
              min={1}
              step={1}
              value={input.teamCount}
              onChange={(event) =>
                patch({
                  teamCount: parsePositiveInt(event.target.value, input.teamCount),
                })
              }
            />
          </Field>

          <Field
            id="portfolio"
            label="Torneos activos del organizador"
            hint="Aplica descuento por volumen según platform_pricing_defaults."
          >
            <NumericInput
              id="portfolio"
              min={1}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface-elevated/40 p-4">
                <p className="text-sm text-text-secondary">Precio total del torneo</p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {formatCotizadorMoney(quote.seasonPrice)}
                </p>
              </div>
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <p className="text-sm text-text-secondary">
                  Precio por equipo (torneo)
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
                    <dt className="text-text-secondary">Base por torneo</dt>
                    <dd className="font-medium">
                      {formatCotizadorMoney(quote.internal.tournamentBase)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Subtotal equipos</dt>
                    <dd className="font-medium">
                      {formatCotizadorMoney(quote.internal.teamSubtotal)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Subtotal antes de volumen</dt>
                    <dd className="font-medium">
                      {formatCotizadorMoney(quote.internal.subtotalBeforeVolume)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Multiplicador volumen</dt>
                    <dd className="font-medium">
                      {quote.internal.volumeBandLabel} (×
                      {quote.internal.volumeMultiplier.toFixed(2)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Descuento en pesos</dt>
                    <dd className="font-medium">
                      −{formatCotizadorMoney(quote.internal.volumeDiscountAmount)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Ingresa al menos 1 equipo para calcular.
          </p>
        )}
      </Card>
    </div>
  );
}
