"use client";

import { useActionState, useState } from "react";
import {
  addSeasonExpenseAction,
  addTeamChargesAction,
  recordPaymentAction,
  voidSeasonExpenseAction,
  voidTeamChargeAction,
  voidTeamPaymentAction,
} from "@/lib/finance/actions";
import {
  buildOverpaymentWarning,
  computeTeamBalance,
  summarizeSeasonExpensesTotal,
  summarizeSeasonFinanceWithMargin,
} from "@/lib/finance/balance";
import {
  CHARGE_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SEASON_EXPENSE_CATEGORY_OPTIONS,
  chargeTypeLabel,
  financeTeamStatusLabel,
  initialFinanceActionState,
  paymentMethodLabel,
  seasonExpenseCategoryLabel,
  type SeasonExpenseRow,
  type SeasonFinanceTeamRow,
} from "@/lib/finance/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ResponsiveTableContainer } from "@/components/ui/ResponsiveTableContainer";
import { cn } from "@/lib/utils/cn";

type SeasonFinancePanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  teams: SeasonFinanceTeamRow[];
  expenses: SeasonExpenseRow[];
  readOnly?: boolean;
};

function financeStatusVariant(
  status: SeasonFinanceTeamRow["status"]
): "success" | "warning" | "default" {
  if (status === "pagado") return "success";
  if (status === "pendiente") return "warning";
  return "default";
}

function ActionMessage({
  ok,
  message,
  tone = "default",
}: {
  ok: boolean;
  message: string | null;
  tone?: "default" | "warning";
}) {
  if (!message) return null;
  const isWarning = tone === "warning";
  return (
    <p
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        !ok
          ? "border-danger/40 bg-danger/10 text-danger"
          : isWarning
            ? "border-warning/40 bg-warning/10 text-warning"
            : "border-success/40 bg-success/10 text-success"
      )}
      role={ok ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

function isOverpaymentMessage(message: string | null): boolean {
  return message?.includes("saldo a favor") ?? false;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

export function AddTeamChargeForm({
  organizationId,
  competitionId,
  seasonId,
  teams,
}: SeasonFinancePanelProps) {
  const [state, action, pending] = useActionState(
    addTeamChargesAction,
    initialFinanceActionState
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleTeam(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Agregar cargo"
        description="Se crea un cargo independiente por cada equipo seleccionado."
      />
      <ActionMessage ok={state.ok} message={state.message} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="chargeType" className="block text-sm font-medium">
              Tipo
            </label>
            <select
              id="chargeType"
              name="chargeType"
              defaultValue={String(state.values?.chargeType ?? "registration")}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {CHARGE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.chargeType && (
              <p className="text-xs text-danger">{state.fieldErrors.chargeType}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="amount" className="block text-sm font-medium">
              Monto (MXN)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={String(state.values?.amount ?? "")}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            {state.fieldErrors?.amount && (
              <p className="text-xs text-danger">{state.fieldErrors.amount}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium">
            Descripción
          </label>
          <input
            id="description"
            name="description"
            type="text"
            defaultValue={String(state.values?.description ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="dueDate" className="block text-sm font-medium">
            Vencimiento (opcional)
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={String(state.values?.dueDate ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm sm:max-w-xs"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Equipos</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.map((team) => (
              <label
                key={team.seasonTeamId}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="seasonTeamIds"
                  value={team.seasonTeamId}
                  checked={selected.has(team.seasonTeamId)}
                  onChange={() => toggleTeam(team.seasonTeamId)}
                  disabled={pending}
                  className="min-h-4 min-w-4"
                />
                {team.teamName}
              </label>
            ))}
          </div>
          {state.fieldErrors?.seasonTeamIds && (
            <p className="text-xs text-danger">{state.fieldErrors.seasonTeamIds}</p>
          )}
        </fieldset>

        <SubmitButton pending={pending} className="w-auto">
          Registrar cargos
        </SubmitButton>
      </form>
    </Card>
  );
}

function formatPaymentDate(value: string): string {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function RecordPaymentForm({
  organizationId,
  competitionId,
  seasonId,
  team,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  team: SeasonFinanceTeamRow;
}) {
  const [state, action, pending] = useActionState(
    recordPaymentAction,
    initialFinanceActionState
  );
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() =>
    team.balanceDue > 0 ? String(team.balanceDue) : ""
  );

  const teamBalance = computeTeamBalance(team.totalCharges, team.totalPayments);
  const paymentAmount = Number(amount);
  const preSubmitOverpaymentWarning =
    amount.trim() !== "" &&
    !Number.isNaN(paymentAmount) &&
    paymentAmount > 0
      ? buildOverpaymentWarning(teamBalance, paymentAmount)
      : null;

  if (team.totalCharges <= 0) return null;

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Registrar pago
        </button>
      ) : (
        <form action={action} className="space-y-3 rounded-xl border border-border p-4">
          <ActionMessage
            ok={state.ok}
            message={state.message}
            tone={
              state.ok && isOverpaymentMessage(state.message)
                ? "warning"
                : "default"
            }
          />
          {preSubmitOverpaymentWarning && (
            <p
              className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
              role="status"
            >
              {preSubmitOverpaymentWarning}
            </p>
          )}
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="seasonTeamId" value={team.seasonTeamId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`pay-amount-${team.seasonTeamId}`} className="block text-sm font-medium">
                Monto (MXN)
              </label>
              <input
                id={`pay-amount-${team.seasonTeamId}`}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`pay-method-${team.seasonTeamId}`} className="block text-sm font-medium">
                Método
              </label>
              <select
                id={`pay-method-${team.seasonTeamId}`}
                name="paymentMethod"
                defaultValue="cash"
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`pay-date-${team.seasonTeamId}`} className="block text-sm font-medium">
                Fecha del pago
              </label>
              <input
                id={`pay-date-${team.seasonTeamId}`}
                name="paidAt"
                type="date"
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`pay-notes-${team.seasonTeamId}`} className="block text-sm font-medium">
                Notas
              </label>
              <input
                id={`pay-notes-${team.seasonTeamId}`}
                name="notes"
                type="text"
                disabled={pending}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pending={pending} className="w-auto">
              Guardar pago
            </SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function VoidEntryForm({
  organizationId,
  competitionId,
  seasonId,
  entryId,
  entryType,
  label,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  entryId: string;
  entryType: "charge" | "payment" | "expense";
  label: string;
}) {
  const actionFn =
    entryType === "charge"
      ? voidTeamChargeAction
      : entryType === "payment"
        ? voidTeamPaymentAction
        : voidSeasonExpenseAction;
  const [state, action, pending] = useActionState(
    actionFn,
    initialFinanceActionState
  );
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-danger hover:underline"
      >
        Anular
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <ActionMessage ok={state.ok} message={state.message} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input
        type="hidden"
        name={
          entryType === "charge"
            ? "chargeId"
            : entryType === "payment"
              ? "paymentId"
              : "expenseId"
        }
        value={entryId}
      />
      <input
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo obligatorio"
        required
        disabled={pending}
        className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      {state.fieldErrors?.reason && (
        <p className="text-xs text-danger">{state.fieldErrors.reason}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton pending={pending} className="w-auto text-sm">
          Confirmar anulación
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="min-h-11 rounded-xl border border-border px-3 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SeasonFinanceSummary({
  teams,
  expenses,
}: {
  teams: SeasonFinanceTeamRow[];
  expenses: SeasonExpenseRow[];
}) {
  const totalExpenses = summarizeSeasonExpensesTotal(
    expenses.map((expense) => expense.amount)
  );
  const totals = summarizeSeasonFinanceWithMargin(teams, totalExpenses);
  const showCredit = totals.totalCredit > 0;

  return (
    <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Total cargos</p>
        <p className="text-lg font-semibold">{formatMoney(totals.totalCharges)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Total cobrado</p>
        <p className="text-lg font-semibold">{formatMoney(totals.totalCollected)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Total pendiente</p>
        <p className="text-lg font-semibold">{formatMoney(totals.totalPending)}</p>
      </div>
      {showCredit && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Saldo a favor</p>
          <p className="text-lg font-semibold">{formatMoney(totals.totalCredit)}</p>
        </div>
      )}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Total gastos</p>
        <p className="text-lg font-semibold">{formatMoney(totals.totalExpenses)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Margen</p>
        <p
          className={cn(
            "text-lg font-semibold",
            totals.margin < 0 ? "text-danger" : "text-text-primary"
          )}
        >
          {formatMoney(totals.margin)}
        </p>
        <p className="text-[11px] text-muted">Cobrado − gastos (caja real)</p>
      </div>
    </Card>
  );
}

export function AddSeasonExpenseForm({
  organizationId,
  competitionId,
  seasonId,
}: Pick<
  SeasonFinancePanelProps,
  "organizationId" | "competitionId" | "seasonId"
>) {
  const [state, action, pending] = useActionState(
    addSeasonExpenseAction,
    initialFinanceActionState
  );

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Agregar gasto"
        description="Registra un costo que paga el organizador (cancha, arbitraje, premios, etc.)."
      />
      <ActionMessage ok={state.ok} message={state.message} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="expenseCategory" className="block text-sm font-medium">
              Categoría
            </label>
            <select
              id="expenseCategory"
              name="category"
              defaultValue={String(state.values?.category ?? "cancha")}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {SEASON_EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.category && (
              <p className="text-xs text-danger">{state.fieldErrors.category}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expenseAmount" className="block text-sm font-medium">
              Monto (MXN)
            </label>
            <input
              id="expenseAmount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={String(state.values?.amount ?? "")}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            {state.fieldErrors?.amount && (
              <p className="text-xs text-danger">{state.fieldErrors.amount}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expenseDescription" className="block text-sm font-medium">
            Descripción
          </label>
          <input
            id="expenseDescription"
            name="description"
            type="text"
            defaultValue={String(state.values?.description ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expenseIncurredAt" className="block text-sm font-medium">
            Fecha del gasto
          </label>
          <input
            id="expenseIncurredAt"
            name="incurredAt"
            type="date"
            defaultValue={String(state.values?.incurredAt ?? "")}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm sm:max-w-xs"
          />
          {state.fieldErrors?.incurredAt && (
            <p className="text-xs text-danger">{state.fieldErrors.incurredAt}</p>
          )}
        </div>

        <SubmitButton pending={pending} className="w-auto">
          Registrar gasto
        </SubmitButton>
      </form>
    </Card>
  );
}

function SeasonExpensesSection({
  organizationId,
  competitionId,
  seasonId,
  expenses,
  readOnly = false,
}: SeasonFinancePanelProps) {
  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Gastos del torneo"
        description="Costos pagados por el organizador. Se restan del total cobrado para calcular el margen."
      />
      {expenses.length === 0 ? (
        <p className="text-sm text-text-secondary">Sin gastos registrados.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {seasonExpenseCategoryLabel(expense.category)}
                    {expense.description ? ` · ${expense.description}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {expense.incurredAt} · Registrado por {expense.recordedByName}
                  </p>
                </div>
                <span className="font-semibold">{formatMoney(expense.amount)}</span>
              </div>
              {!readOnly && (
                <VoidEntryForm
                  organizationId={organizationId}
                  competitionId={competitionId}
                  seasonId={seasonId}
                  entryId={expense.id}
                  entryType="expense"
                  label="Anular este gasto"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function SeasonFinanceTable({
  organizationId,
  competitionId,
  seasonId,
  teams,
  expenses,
  readOnly = false,
}: SeasonFinancePanelProps) {
  if (teams.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          No hay equipos inscritos en este torneo.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SeasonFinanceSummary teams={teams} expenses={expenses} />
      <ResponsiveTableContainer label="Finanzas por equipo">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Equipo</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Cargos</th>
              <th className="px-3 py-2 font-medium">Pagos</th>
              <th className="px-3 py-2 font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.seasonTeamId} className="border-t border-border">
                <td className="px-3 py-3 font-medium">{team.teamName}</td>
                <td className="px-3 py-3">
                  <StatusBadge
                    label={financeTeamStatusLabel(team.status)}
                    variant={financeStatusVariant(team.status)}
                  />
                </td>
                <td className="px-3 py-3">{formatMoney(team.totalCharges)}</td>
                <td className="px-3 py-3">{formatMoney(team.totalPayments)}</td>
                <td className="px-3 py-3 font-medium">
                  {team.status === "sin_cargos"
                    ? "—"
                    : formatMoney(team.balanceDue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTableContainer>

      {teams.map((team) => (
        <Card key={team.seasonTeamId} className="space-y-4">
          <SectionHeader title={team.teamName} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted">Saldo pendiente</p>
              <p className="text-xl font-semibold text-text-primary">
                {team.totalCharges <= 0
                  ? "—"
                  : team.balanceDue > 0
                    ? formatMoney(team.balanceDue)
                    : team.balanceDue < 0
                      ? `Saldo a favor ${formatMoney(Math.abs(team.balanceDue))}`
                      : formatMoney(0)}
              </p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted">Total cargos</p>
              <p className="text-lg font-semibold">{formatMoney(team.totalCharges)}</p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted">Total pagado</p>
              <p className="text-lg font-semibold">{formatMoney(team.totalPayments)}</p>
            </Card>
          </div>
          {!readOnly && (
            <RecordPaymentForm
              organizationId={organizationId}
              competitionId={competitionId}
              seasonId={seasonId}
              team={team}
            />
          )}

          {(team.charges.length > 0 || team.payments.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Cargos activos</h4>
                {team.charges.length === 0 ? (
                  <p className="text-sm text-text-secondary">Sin cargos.</p>
                ) : (
                  <ul className="space-y-2">
                    {team.charges.map((charge) => (
                      <li
                        key={charge.id}
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <div className="flex justify-between gap-2">
                          <span>
                            {chargeTypeLabel(charge.chargeType)}
                            {charge.description
                              ? ` · ${charge.description}`
                              : ""}
                          </span>
                          <span className="font-medium">
                            {formatMoney(charge.amount)}
                          </span>
                        </div>
                        {!readOnly && (
                          <VoidEntryForm
                            organizationId={organizationId}
                            competitionId={competitionId}
                            seasonId={seasonId}
                            entryId={charge.id}
                            entryType="charge"
                            label="Anular este cargo"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Historial de pagos</h4>
                {team.payments.length === 0 ? (
                  <p className="text-sm text-text-secondary">Sin pagos.</p>
                ) : (
                  <ul className="space-y-2">
                    {team.payments.map((payment) => (
                      <li
                        key={payment.id}
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <div className="flex justify-between gap-2">
                          <span>
                            {formatPaymentDate(payment.paidAt)} ·{" "}
                            {paymentMethodLabel(payment.paymentMethod)}
                          </span>
                          <span className="font-medium">
                            {formatMoney(payment.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-muted">
                          Registrado por {payment.recordedByName}
                          {payment.notes ? ` · ${payment.notes}` : ""}
                        </p>
                        {!readOnly && (
                          <VoidEntryForm
                            organizationId={organizationId}
                            competitionId={competitionId}
                            seasonId={seasonId}
                            entryId={payment.id}
                            entryType="payment"
                            label="Anular este pago"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function SeasonFinancePanel({
  readOnly = false,
  ...props
}: SeasonFinancePanelProps) {
  return (
    <div className="space-y-6">
      {!readOnly && <AddTeamChargeForm {...props} />}
      {!readOnly && <AddSeasonExpenseForm {...props} />}
      <SeasonFinanceTable {...props} readOnly={readOnly} />
      <SeasonExpensesSection {...props} readOnly={readOnly} />
    </div>
  );
}
