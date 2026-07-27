"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import {
  initialPlatformFinanceActionState,
  recordPlatformExpenseAction,
  recordPlatformIncomeAction,
  voidPlatformExpenseAction,
  voidPlatformIncomeAction,
} from "@/lib/platform-finance/actions";
import {
  PLATFORM_EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  formatPlatformMoney,
  type PlatformFinanceSummary,
} from "@/lib/platform-finance/types";
import { cn } from "@/lib/utils/cn";

type PlatformFinancePanelProps = {
  summary: PlatformFinanceSummary;
};

const inputClassName =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-brand";

function formatRecordedAt(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ActionMessage({ ok, message }: { ok: boolean; message: string | null }) {
  if (!message) return null;
  return (
    <p
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger"
      )}
      role={ok ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

function MonthSelector({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const router = useRouter();
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Intl.DateTimeFormat("es-MX", { month: "long" }).format(
          new Date(2026, index, 1)
        ),
      })),
    []
  );

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const nextYear = String(data.get("year") ?? year);
        const nextMonth = String(data.get("month") ?? month);
        router.push(`/plataforma/finanzas?anio=${nextYear}&mes=${nextMonth}`);
      }}
    >
      <label className="space-y-1.5 text-sm">
        <span className="font-medium text-text-primary">Año</span>
        <input
          name="year"
          type="number"
          min={2000}
          max={2100}
          defaultValue={year}
          className={cn(inputClassName, "w-28")}
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium text-text-primary">Mes</span>
        <select
          name="month"
          defaultValue={month}
          className={cn(inputClassName, "w-40 capitalize")}
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-elevated"
      >
        Ver mes
      </button>
    </form>
  );
}

export function PlatformFinancePanel({ summary }: PlatformFinancePanelProps) {
  const [incomeState, incomeAction, incomePending] = useActionState(
    recordPlatformIncomeAction,
    initialPlatformFinanceActionState
  );
  const [expenseState, expenseAction, expensePending] = useActionState(
    recordPlatformExpenseAction,
    initialPlatformFinanceActionState
  );
  const [voidIncomeState, voidIncomeAction] = useActionState(
    voidPlatformIncomeAction,
    initialPlatformFinanceActionState
  );
  const [voidExpenseState, voidExpenseAction] = useActionState(
    voidPlatformExpenseAction,
    initialPlatformFinanceActionState
  );
  const [voidIncomeId, setVoidIncomeId] = useState<string | null>(null);
  const [voidExpenseId, setVoidExpenseId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Periodo</h2>
        <MonthSelector year={summary.year} month={summary.month} />
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-elevated p-4">
            <dt className="text-sm text-text-secondary">Ingresos</dt>
            <dd className="mt-1 text-xl font-semibold text-text-primary">
              {formatPlatformMoney(summary.totalIncome)}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated p-4">
            <dt className="text-sm text-text-secondary">Egresos</dt>
            <dd className="mt-1 text-xl font-semibold text-text-primary">
              {formatPlatformMoney(summary.totalExpenses)}
            </dd>
          </div>
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
            <dt className="text-sm text-text-secondary">Neto del mes</dt>
            <dd className="mt-1 text-xl font-semibold text-text-primary">
              {formatPlatformMoney(summary.net)}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-text-secondary">
          Control interno informal — no sustituye contabilidad fiscal ni cumplimiento
          RESICO/SAT.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Registrar ingreso suelto
          </h2>
          <form action={incomeAction} className="space-y-3">
            <input type="hidden" name="year" value={summary.year} />
            <input type="hidden" name="month" value={summary.month} />
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Monto (MXN)</span>
              <input
                name="amount"
                type="number"
                min={0.01}
                step={0.01}
                required
                className={inputClassName}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Notas (opcional)</span>
              <input name="notes" type="text" className={inputClassName} />
            </label>
            <SubmitButton pending={incomePending}>Registrar ingreso</SubmitButton>
          </form>
          <ActionMessage ok={incomeState.ok} message={incomeState.message} />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Registrar egreso
          </h2>
          <form action={expenseAction} className="space-y-3">
            <input type="hidden" name="year" value={summary.year} />
            <input type="hidden" name="month" value={summary.month} />
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Categoria</span>
              <select name="category" required className={inputClassName}>
                {PLATFORM_EXPENSE_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Monto (MXN)</span>
              <input
                name="amount"
                type="number"
                min={0.01}
                step={0.01}
                required
                className={inputClassName}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Notas (opcional)</span>
              <input name="notes" type="text" className={inputClassName} />
            </label>
            <SubmitButton pending={expensePending}>Registrar egreso</SubmitButton>
          </form>
          <ActionMessage ok={expenseState.ok} message={expenseState.message} />
        </Card>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Ingresos del mes</h2>
        <ActionMessage ok={voidIncomeState.ok} message={voidIncomeState.message} />
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Organizacion</th>
                <th className="px-3 py-2 font-medium">Temporada</th>
                <th className="px-3 py-2 font-medium">Monto</th>
                <th className="px-3 py-2 font-medium">Notas</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Accion</th>
              </tr>
            </thead>
            <tbody>
              {summary.incomeEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-text-secondary">
                    Sin ingresos en este mes.
                  </td>
                </tr>
              ) : (
                summary.incomeEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-border align-top">
                    <td className="px-3 py-3">{formatRecordedAt(entry.recordedAt)}</td>
                    <td className="px-3 py-3">
                      {entry.organizationName ?? "—"}
                    </td>
                    <td className="px-3 py-3">{entry.seasonName ?? "Suelto"}</td>
                    <td className="px-3 py-3 font-medium">
                      {formatPlatformMoney(entry.amount)}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {entry.notes ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {entry.voidedAt ? (
                        <span className="text-danger">
                          Anulado: {entry.voidReason}
                        </span>
                      ) : (
                        "Activo"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!entry.voidedAt && (
                        voidIncomeId === entry.id ? (
                          <form action={voidIncomeAction} className="flex flex-wrap gap-2">
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="year" value={summary.year} />
                            <input type="hidden" name="month" value={summary.month} />
                            <input
                              name="reason"
                              required
                              placeholder="Motivo"
                              className="min-h-11 min-w-[8rem] rounded-xl border border-border px-2 text-sm"
                            />
                            <SubmitButton className="w-auto px-3">Anular</SubmitButton>
                            <button
                              type="button"
                              onClick={() => setVoidIncomeId(null)}
                              className="text-sm text-text-secondary"
                            >
                              Cancelar
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVoidIncomeId(entry.id)}
                            className="text-sm font-medium text-brand"
                          >
                            Anular…
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Egresos del mes</h2>
        <ActionMessage ok={voidExpenseState.ok} message={voidExpenseState.message} />
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Categoria</th>
                <th className="px-3 py-2 font-medium">Monto</th>
                <th className="px-3 py-2 font-medium">Notas</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Accion</th>
              </tr>
            </thead>
            <tbody>
              {summary.expenseEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-secondary">
                    Sin egresos en este mes.
                  </td>
                </tr>
              ) : (
                summary.expenseEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-border align-top">
                    <td className="px-3 py-3">{formatRecordedAt(entry.recordedAt)}</td>
                    <td className="px-3 py-3">
                      {expenseCategoryLabel(entry.category)}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {formatPlatformMoney(entry.amount)}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {entry.notes ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {entry.voidedAt ? (
                        <span className="text-danger">
                          Anulado: {entry.voidReason}
                        </span>
                      ) : (
                        "Activo"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!entry.voidedAt && (
                        voidExpenseId === entry.id ? (
                          <form action={voidExpenseAction} className="flex flex-wrap gap-2">
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="year" value={summary.year} />
                            <input type="hidden" name="month" value={summary.month} />
                            <input
                              name="reason"
                              required
                              placeholder="Motivo"
                              className="min-h-11 min-w-[8rem] rounded-xl border border-border px-2 text-sm"
                            />
                            <SubmitButton className="w-auto px-3">Anular</SubmitButton>
                            <button
                              type="button"
                              onClick={() => setVoidExpenseId(null)}
                              className="text-sm text-text-secondary"
                            >
                              Cancelar
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVoidExpenseId(entry.id)}
                            className="text-sm font-medium text-brand"
                          >
                            Anular…
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
