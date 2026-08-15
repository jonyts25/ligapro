"use client";

import { useActionState, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  initialPlatformBillingActionState,
  setOrganizationPlanTierAction,
} from "@/lib/platform-billing/actions";
import {
  PLATFORM_PLAN_TIERS,
  planTierLabel,
  type PlatformOrganizationBillingRow,
  type PlatformPlanTier,
} from "@/lib/platform-billing/types";
import { cn } from "@/lib/utils/cn";

type OrgTierRowProps = {
  row: PlatformOrganizationBillingRow;
  isConfirming: boolean;
  pending: boolean;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onSubmit: () => void;
  formAction: (payload: FormData) => void;
};

function OrgTierRow({
  row,
  isConfirming,
  pending,
  onStartConfirm,
  onCancelConfirm,
  onSubmit,
  formAction,
}: OrgTierRowProps) {
  const [targetTier, setTargetTier] = useState<PlatformPlanTier>(row.planTier);

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-3 font-medium">{row.organizationName}</td>
      <td className="px-3 py-3">
        <StatusBadge
          label={planTierLabel(row.planTier)}
          variant={row.planTier === "premium" ? "success" : "info"}
        />
      </td>
      <td className="px-3 py-3 text-text-secondary">{row.activeSeasonCount}</td>
      <td className="px-3 py-3">
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-2"
          onSubmit={onSubmit}
        >
          <input type="hidden" name="organizationId" value={row.organizationId} />
          <input
            type="hidden"
            name="confirmed"
            value={isConfirming ? "1" : "0"}
          />
          <select
            name="planTier"
            value={targetTier}
            onChange={(event) =>
              setTargetTier(event.target.value as PlatformPlanTier)
            }
            disabled={pending}
            className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm"
          >
            {PLATFORM_PLAN_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
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

type PlatformOrganizationTierPanelProps = {
  rows: PlatformOrganizationBillingRow[];
};

export function PlatformOrganizationTierPanel({
  rows,
}: PlatformOrganizationTierPanelProps) {
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [actionState, formAction, pending] = useActionState(
    setOrganizationPlanTierAction,
    initialPlatformBillingActionState
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      r.organizationName.toLowerCase().includes(needle)
    );
  }, [rows, search]);

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Plan comercial por organización
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Básico vs Premium controla features como resumen de jornada con IA y
          patrocinios (cuando existan).
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar organización…"
        className="min-h-11 w-full max-w-md rounded-xl border border-border bg-background px-3 text-sm"
      />

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
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Organización</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Temporadas activas</th>
              <th className="px-3 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-text-secondary"
                >
                  No hay organizaciones con este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const rowKey = row.organizationId;
                return (
                  <OrgTierRow
                    key={rowKey}
                    row={row}
                    isConfirming={confirmKey === rowKey}
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
    </Card>
  );
}
