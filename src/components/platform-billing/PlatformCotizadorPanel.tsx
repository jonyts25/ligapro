"use client";

import {
  useCallback,
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
  createCotizadorLine,
  formatCotizadorMoney,
  type CotizadorLine,
  type CotizadorParams,
  type DurationBand,
} from "@/lib/platform-billing/cotizador";
import { setPlatformPricingDefaultsAction } from "@/lib/platform-billing/actions";
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

type PlatformCotizadorPanelProps = {
  initialParams: CotizadorParams;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function paramsEqual(a: CotizadorParams, b: CotizadorParams): boolean {
  return (
    a.basePricePerTeam === b.basePricePerTeam &&
    a.durationMultiplierHasta3 === b.durationMultiplierHasta3 &&
    a.durationMultiplier4To6 === b.durationMultiplier4To6 &&
    a.durationMultiplier7To12 === b.durationMultiplier7To12 &&
    a.volumeMultiplier1To2 === b.volumeMultiplier1To2 &&
    a.volumeMultiplier3To5 === b.volumeMultiplier3To5 &&
    a.volumeMultiplier6Plus === b.volumeMultiplier6Plus
  );
}

export function PlatformCotizadorPanel({
  initialParams,
}: PlatformCotizadorPanelProps) {
  const [lines, setLines] = useState<CotizadorLine[]>(() => [createCotizadorLine()]);
  const [params, setParams] = useState<CotizadorParams>(initialParams);
  const [paramsOpen, setParamsOpen] = useState(true);
  const [clientName, setClientName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedParams, setLastSavedParams] = useState(initialParams);

  const quote = useMemo(() => calculateCotizacion(lines, params), [lines, params]);

  const paramsDirty = useMemo(
    () => !paramsEqual(params, lastSavedParams),
    [params, lastSavedParams]
  );

  const saveParams = useCallback(async () => {
    setSaveState("saving");
    setSaveError(null);

    const result = await setPlatformPricingDefaultsAction(params);
    if (result.ok) {
      setLastSavedParams(params);
      setSaveState("saved");
      setSaveError(null);
      return;
    }

    setSaveState("error");
    setSaveError(result.message ?? "No se pudieron guardar los parametros.");
  }, [params]);

  function updateLine(id: string, patch: Partial<Omit<CotizadorLine, "id">>) {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, createCotizadorLine()]);
  }

  function removeLine(id: string) {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((line) => line.id !== id);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Líneas de torneo
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Cada línea es un torneo con equipos y duración propios. El descuento
              por volumen se aplica al total combinado.{" "}
              <span className="font-medium text-text-primary">
                Las líneas no se guardan al recargar.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
          >
            Agregar torneo
          </button>
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

        <div className="space-y-4">
          {lines.map((line, index) => (
            <div
              key={line.id}
              className="rounded-xl border border-border bg-surface-elevated/40 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  Torneo {index + 1}
                </h3>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="text-sm font-medium text-text-secondary hover:text-text-primary"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`teams-${line.id}`} label="Número de equipos">
                  <NumericInput
                    id={`teams-${line.id}`}
                    min={1}
                    step={1}
                    value={line.teamCount}
                    onChange={(event) =>
                      updateLine(line.id, {
                        teamCount: parsePositiveInt(
                          event.target.value,
                          line.teamCount
                        ),
                      })
                    }
                  />
                </Field>

                <Field id={`duration-${line.id}`} label="Duración">
                  <select
                    id={`duration-${line.id}`}
                    value={line.durationBand}
                    onChange={(event) =>
                      updateLine(line.id, {
                        durationBand: event.target.value as DurationBand,
                      })
                    }
                    className={inputClassName}
                  >
                    <option value="hasta_3">≤ 3 meses</option>
                    <option value="4_6">4–6 meses</option>
                    <option value="7_12">7–12 meses</option>
                  </select>
                </Field>
              </div>
            </div>
          ))}
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
              Valores compartidos para todo el staff de plataforma. Usa el botón
              Guardar después de editar.
            </p>
            {saveState === "saved" && !paramsDirty && (
              <p className="mt-1 text-xs font-medium text-brand">
                Parámetros guardados en Supabase
              </p>
            )}
            {saveState === "error" && saveError && (
              <p className="mt-1 text-xs text-red-600">{saveError}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-medium text-brand">
            {paramsOpen ? "Ocultar" : "Mostrar"}
          </span>
        </button>

        {paramsOpen && (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="base-price" label="Precio base por equipo (MXN)">
              <NumericInput
                id="base-price"
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
              />
            </Field>

            <Field
              id="dur-hasta-3"
              label="Multiplicador ≤ 3 meses"
              hint="Duración corta"
            >
              <NumericInput
                id="dur-hasta-3"
                min={0}
                step={0.01}
                value={params.durationMultiplierHasta3}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    durationMultiplierHasta3: parsePositiveFloat(
                      event.target.value,
                      prev.durationMultiplierHasta3
                    ),
                  }))
                }
              />
            </Field>

            <Field
              id="dur-4-6"
              label="Multiplicador 4–6 meses"
              hint="Duración media"
            >
              <NumericInput
                id="dur-4-6"
                min={0}
                step={0.01}
                value={params.durationMultiplier4To6}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    durationMultiplier4To6: parsePositiveFloat(
                      event.target.value,
                      prev.durationMultiplier4To6
                    ),
                  }))
                }
              />
            </Field>

            <Field
              id="dur-7-12"
              label="Multiplicador 7–12 meses"
              hint="Duración larga"
            >
              <NumericInput
                id="dur-7-12"
                min={0}
                step={0.01}
                value={params.durationMultiplier7To12}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    durationMultiplier7To12: parsePositiveFloat(
                      event.target.value,
                      prev.durationMultiplier7To12
                    ),
                  }))
                }
              />
            </Field>

            <Field id="vol-1-2" label="Multiplicador volumen 1–2 torneos">
              <NumericInput
                id="vol-1-2"
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
              />
            </Field>

            <Field id="vol-3-5" label="Multiplicador volumen 3–5 torneos">
              <NumericInput
                id="vol-3-5"
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
              />
            </Field>

            <Field id="vol-6-plus" label="Multiplicador volumen 6+ torneos">
              <NumericInput
                id="vol-6-plus"
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
              />
            </Field>
          </div>
        )}

        {paramsOpen && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => void saveParams()}
              disabled={saveState === "saving" || !paramsDirty}
              className={cn(
                "inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold",
                paramsDirty
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface-elevated text-text-secondary",
                saveState === "saving" && "opacity-70"
              )}
            >
              {saveState === "saving" ? "Guardando…" : "Guardar parámetros"}
            </button>
            {paramsDirty && saveState !== "saving" && (
              <p className="text-sm text-text-secondary">
                Hay cambios sin guardar
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Resultado</h2>
          {quote && (
            <button
              type="button"
              onClick={() =>
                downloadCotizadorPdf({
                  quote,
                  params,
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
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">Torneos en la cotización</dt>
                <dd className="font-medium text-text-primary">
                  {quote.tournamentCount}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Banda de volumen</dt>
                <dd className="font-medium text-text-primary">
                  {quote.volumeBand} (×{quote.volumeMultiplier.toFixed(2)})
                </dd>
              </div>
            </dl>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-elevated text-left text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-medium">Torneo</th>
                    <th className="px-3 py-2 font-medium">Equipos</th>
                    <th className="px-3 py-2 font-medium">Duración</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line, index) => (
                    <tr key={line.lineId} className="border-t border-border">
                      <td className="px-3 py-2">#{index + 1}</td>
                      <td className="px-3 py-2">{line.teamCount}</td>
                      <td className="px-3 py-2">
                        {line.durationLabel} (×{line.durationMultiplier.toFixed(2)})
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCotizadorMoney(line.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-surface-elevated p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-text-secondary">
                  Total antes de descuento por volumen
                </span>
                <span className="font-medium text-text-primary">
                  {formatCotizadorMoney(quote.subtotalBeforeVolume)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-secondary">
                  Descuento por volumen ({quote.volumeBand})
                </span>
                <span className="font-medium text-text-primary">
                  {quote.volumeDiscountAmount > 0
                    ? `−${formatCotizadorMoney(quote.volumeDiscountAmount)}`
                    : formatCotizadorMoney(0)}
                </span>
              </div>
            </div>

            <div
              className={cn("rounded-xl border border-brand/30 bg-brand/5 p-4")}
            >
              <p className="text-sm text-text-secondary">Total final</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {formatCotizadorMoney(quote.finalTotal)}
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                {formatCotizadorMoney(quote.subtotalBeforeVolume)} ×{" "}
                {quote.volumeMultiplier.toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Agrega al menos un torneo con equipos válidos para ver el resultado.
          </p>
        )}
      </Card>
    </div>
  );
}
