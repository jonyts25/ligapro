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
  type LiguillaClasificados,
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
  const [showInternal, setShowInternal] = useState(false);

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
            Cotización por volumen de partidos/mes. Los valores no se guardan al
            recargar.
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
          <Field id="equipos" label="Equipos">
            <NumericInput
              id="equipos"
              min={2}
              step={1}
              value={input.equipos}
              onChange={(event) =>
                patch({ equipos: parsePositiveInt(event.target.value, input.equipos) })
              }
            />
          </Field>

          <Field id="vueltas" label="Vueltas">
            <select
              id="vueltas"
              value={input.vueltas}
              onChange={(event) =>
                patch({ vueltas: Number(event.target.value) === 2 ? 2 : 1 })
              }
              className={inputClassName}
            >
              <option value={1}>Una vuelta</option>
              <option value={2}>Ida y vuelta</option>
            </select>
          </Field>

          <Field id="liguilla" label="Liguilla (clasificados)">
            <select
              id="liguilla"
              value={input.liguilla}
              onChange={(event) =>
                patch({ liguilla: event.target.value as LiguillaClasificados })
              }
              className={inputClassName}
            >
              <option value="ninguna">Ninguna</option>
              <option value="top4">Top 4</option>
              <option value="top8">Top 8</option>
              <option value="top16">Top 16</option>
            </select>
          </Field>

          <Field id="meses" label="Duración (meses)">
            <NumericInput
              id="meses"
              min={1}
              step={1}
              value={input.duracionMeses}
              onChange={(event) =>
                patch({
                  duracionMeses: parsePositiveInt(
                    event.target.value,
                    input.duracionMeses
                  ),
                })
              }
            />
          </Field>

          <Field id="costo-cancha" label="Costo de cancha reportado (MXN/partido)">
            <NumericInput
              id="costo-cancha"
              min={0}
              step={1}
              value={input.costoCanchaPorPartido}
              onChange={(event) =>
                patch({
                  costoCanchaPorPartido: parsePositiveFloat(
                    event.target.value,
                    input.costoCanchaPorPartido
                  ),
                })
              }
            />
          </Field>

          <Field
            id="torneos-activos"
            label="Torneos activos del organizador (ese mes)"
          >
            <NumericInput
              id="torneos-activos"
              min={1}
              max={10}
              step={1}
              value={input.torneosActivosMes}
              onChange={(event) =>
                patch({
                  torneosActivosMes: parsePositiveInt(
                    event.target.value,
                    input.torneosActivosMes
                  ),
                })
              }
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={input.partidoTercerLugar}
            onChange={(event) =>
              patch({ partidoTercerLugar: event.target.checked })
            }
            disabled={input.liguilla === "ninguna"}
          />
          Partido por el tercer lugar (solo si clasificados ≥ 4)
        </label>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">
            Resultado (mostrar al cliente)
          </h2>
          {quote && (
            <button
              type="button"
              onClick={() =>
                downloadCotizadorPdf({
                  quote,
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
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <p className="text-sm text-text-secondary">Precio mensual</p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {formatCotizadorMoney(quote.precioMensualFinal)}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm text-text-secondary">Precio temporada</p>
                <p className="mt-1 text-xl font-semibold text-text-primary">
                  {formatCotizadorMoney(quote.precioTemporada)}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm text-text-secondary">
                  Precio por equipo (temporada)
                </p>
                <p className="mt-1 text-xl font-semibold text-text-primary">
                  {formatCotizadorMoney(quote.precioPorEquipoTemporada)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border/80 bg-surface-elevated/30">
              <button
                type="button"
                onClick={() => setShowInternal((open) => !open)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={showInternal}
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Desglose interno — no mostrar al cliente
                  </p>
                  <p className="text-xs text-text-secondary">
                    Partidos, tier, banda de cancha y descuento portafolio
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-brand">
                  {showInternal ? "Ocultar" : "Mostrar"}
                </span>
              </button>

              {showInternal && (
                <dl className="grid gap-3 border-t border-border px-4 py-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-text-secondary">Partidos fase regular</dt>
                    <dd className="font-medium">{quote.internal.partidosRegular}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Partidos liguilla</dt>
                    <dd className="font-medium">{quote.internal.partidosLiguilla}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Total partidos</dt>
                    <dd className="font-medium">{quote.internal.partidosTotal}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Partidos/mes</dt>
                    <dd className="font-medium">
                      {quote.internal.partidosPorMes.toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Tier</dt>
                    <dd className="font-medium">
                      {quote.internal.tier} —{" "}
                      {formatCotizadorMoney(quote.internal.precioBaseMensual)}/mes
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Banda cancha</dt>
                    <dd className="font-medium">
                      {quote.internal.bandaCanchaLabel} (×
                      {quote.internal.multiplicadorBandaCancha.toFixed(2)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Descuento portafolio</dt>
                    <dd className="font-medium">
                      {quote.internal.descuentoPortafolioLabel} (
                      {(quote.internal.descuentoPortafolioPct * 100).toFixed(0)}%)
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Ingresa al menos 2 equipos y una duración válida en meses.
          </p>
        )}
      </Card>
    </div>
  );
}
