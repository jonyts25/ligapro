"use client";

import { useActionState, useState } from "react";
import {
  addTeamChargesAction,
  markTeamPaidAction,
  voidTeamChargeAction,
  voidTeamPaymentAction,
} from "@/lib/finance/actions";
import {
  CHARGE_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  chargeTypeLabel,
  financeTeamStatusLabel,
  initialFinanceActionState,
  paymentMethodLabel,
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
}: {
  ok: boolean;
  message: string | null;
}) {
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

function MarkTeamPaidForm({
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
    markTeamPaidAction,
    initialFinanceActionState
  );

  if (team.balanceDue <= 0) return null;

  return (
    <form action={action} className="space-y-2">
      <ActionMessage ok={state.ok} message={state.message} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="seasonTeamId" value={team.seasonTeamId} />
      <input type="hidden" name="amount" value={String(team.balanceDue)} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label
            htmlFor={`pay-method-${team.seasonTeamId}`}
            className="block text-xs font-medium text-text-secondary"
          >
            Método
          </label>
          <select
            id={`pay-method-${team.seasonTeamId}`}
            name="paymentMethod"
            defaultValue="cash"
            disabled={pending}
            className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pending={pending} className="w-auto">
          Marcar pagado ({formatMoney(team.balanceDue)})
        </SubmitButton>
      </div>
    </form>
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
  entryType: "charge" | "payment";
  label: string;
}) {
  const actionFn =
    entryType === "charge" ? voidTeamChargeAction : voidTeamPaymentAction;
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
        name={entryType === "charge" ? "chargeId" : "paymentId"}
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

export function SeasonFinanceTable({
  organizationId,
  competitionId,
  seasonId,
  teams,
}: SeasonFinancePanelProps) {
  if (teams.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          No hay equipos inscritos en esta temporada.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
          <SectionHeader
            title={team.teamName}
            description={`Saldo pendiente: ${
              team.balanceDue > 0 ? formatMoney(team.balanceDue) : "—"
            }`}
          />
          <MarkTeamPaidForm
            organizationId={organizationId}
            competitionId={competitionId}
            seasonId={seasonId}
            team={team}
          />

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
                        <VoidEntryForm
                          organizationId={organizationId}
                          competitionId={competitionId}
                          seasonId={seasonId}
                          entryId={charge.id}
                          entryType="charge"
                          label="Anular este cargo"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Pagos activos</h4>
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
                            {paymentMethodLabel(payment.paymentMethod)}
                            {payment.reference
                              ? ` · ${payment.reference}`
                              : ""}
                          </span>
                          <span className="font-medium">
                            {formatMoney(payment.amount)}
                          </span>
                        </div>
                        <VoidEntryForm
                          organizationId={organizationId}
                          competitionId={competitionId}
                          seasonId={seasonId}
                          entryId={payment.id}
                          entryType="payment"
                          label="Anular este pago"
                        />
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

export function SeasonFinancePanel(props: SeasonFinancePanelProps) {
  return (
    <div className="space-y-6">
      <AddTeamChargeForm {...props} />
      <SeasonFinanceTable {...props} />
    </div>
  );
}
