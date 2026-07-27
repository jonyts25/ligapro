"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  setPlatformBillingStatusAction,
  initialPlatformBillingActionState,
} from "@/lib/platform-billing/actions";
import {
  PLATFORM_BILLING_STATUSES,
  billingStatusLabel,
  type PlatformBillingRow,
  type PlatformBillingStatus,
} from "@/lib/platform-billing/types";
import { cn } from "@/lib/utils/cn";

type BillingRowActionsProps = {
  row: PlatformBillingRow;
  isConfirming: boolean;
  pending: boolean;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onSubmit: () => void;
  formAction: (payload: FormData) => void;
};

function BillingRowActions({
  row,
  isConfirming,
  pending,
  onStartConfirm,
  onCancelConfirm,
  onSubmit,
  formAction,
}: BillingRowActionsProps) {
  const [targetStatus, setTargetStatus] = useState(row.platformBillingStatus);

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-3 font-medium">{row.organizationName}</td>
      <td className="px-3 py-3">{row.seasonName}</td>
      <td className="px-3 py-3">
        <StatusBadge
          label={billingStatusLabel(row.platformBillingStatus)}
          variant={statusVariant(row.platformBillingStatus)}
        />
      </td>
      <td className="px-3 py-3 text-text-secondary">{row.enrolledTeamCount}</td>
      <td className="px-3 py-3 text-text-secondary">
        {row.hasFixture ? "Sí" : "No"}
      </td>
      <td className="px-3 py-3">
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-2"
          onSubmit={onSubmit}
        >
          <input type="hidden" name="seasonId" value={row.seasonId} />
          <input
            type="hidden"
            name="confirmed"
            value={isConfirming ? "1" : "0"}
          />
          <select
            name="status"
            value={targetStatus}
            onChange={(event) =>
              setTargetStatus(event.target.value as PlatformBillingStatus)
            }
            disabled={pending}
            className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm"
          >
            {PLATFORM_BILLING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {!isConfirming ? (
            <button
              type="button"
              onClick={onStartConfirm}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-surface-elevated"
            >
              Cambiar…
            </button>
          ) : (
            <>
              {targetStatus === "pagado" && (
                <input
                  name="incomeAmount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="Monto ingreso (opcional)"
                  className="min-h-11 min-w-[10rem] rounded-xl border border-border bg-background px-2 text-sm"
                />
              )}
              <input
                name="reason"
                placeholder="Motivo (opcional)"
                className="min-h-11 min-w-[8rem] rounded-xl border border-border bg-background px-2 text-sm"
              />
              <SubmitButton pending={pending} className="w-auto px-4">
                Confirmar
              </SubmitButton>
              <button
                type="button"
                onClick={onCancelConfirm}
                className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm text-text-secondary"
              >
                Cancelar
              </button>
            </>
          )}
        </form>
      </td>
    </tr>
  );
}

type PlatformBillingPanelProps = {
  rows: PlatformBillingRow[];
  initialFilter?: string;
};

function statusVariant(
  status: string
): "success" | "warning" | "info" {
  if (status === "pagado") return "success";
  if (status === "vencido") return "warning";
  return "info";
}

export function PlatformBillingPanel({
  rows,
  initialFilter = "all",
}: PlatformBillingPanelProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [actionState, formAction, pending] = useActionState(
    setPlatformBillingStatusAction,
    initialPlatformBillingActionState
  );

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.platformBillingStatus === filter);
  }, [rows, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Todas"],
            ...PLATFORM_BILLING_STATUSES.map(
              (s) => [s.value, s.label] as const
            ),
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium",
              filter === value
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-text-secondary hover:bg-surface-elevated"
            )}
          >
            {label}
          </button>
        ))}
      </div>

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

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Organización</th>
              <th className="px-3 py-2 font-medium">Temporada</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Equipos</th>
              <th className="px-3 py-2 font-medium">Fixture</th>
              <th className="px-3 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-text-secondary"
                >
                  No hay temporadas con este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const rowKey = row.seasonId;
                const isConfirming = confirmKey === rowKey;
                return (
                  <BillingRowActions
                    key={rowKey}
                    row={row}
                    isConfirming={isConfirming}
                    pending={pending && pendingKey === rowKey}
                    onStartConfirm={() => setConfirmKey(rowKey)}
                    onCancelConfirm={() => setConfirmKey(null)}
                    onSubmit={() => setPendingKey(rowKey)}
                    formAction={formAction}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Card className="p-4 text-sm text-text-secondary">
        <p>
          Cambiar a <strong>pagado</strong> habilita fixture y bracket;{" "}
          <strong>vencido</strong> o <strong>pendiente</strong> bloquea la
          generación operativa del cliente. Al marcar pagado puedes registrar
          opcionalmente el monto como ingreso interno.
        </p>
        <p className="mt-2">
          <Link
            href="/seleccionar-organizacion"
            className="font-medium text-brand hover:underline"
          >
            Volver a organizaciones
          </Link>
        </p>
      </Card>
    </div>
  );
}
