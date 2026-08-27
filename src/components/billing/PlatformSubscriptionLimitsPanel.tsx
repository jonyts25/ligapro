"use client";

import { useActionState, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import {
  formatLimitReachedMessage,
  formatUsageLabel,
  SUBSCRIPTION_TIER_OPTIONS,
  subscriptionTierLabel,
  type TierLimitKey,
} from "@/lib/billing/tier-limits";
import type { PlatformOrganizationSubscriptionRow } from "@/lib/billing/platform-subscription-queries";
import {
  initialPlatformSubscriptionActionState,
  setOrganizationSubscriptionLimitsAction,
} from "@/lib/billing/platform-subscription-actions";
import { cn } from "@/lib/utils/cn";

const RESOURCE_ROWS: Array<{ key: TierLimitKey; label: string }> = [
  { key: "torneos_activos", label: "Torneos activos" },
  { key: "sedes", label: "Sedes activas" },
  { key: "canchas_total", label: "Canchas activas" },
  { key: "usuarios_staff", label: "Usuarios staff" },
  { key: "cronicas_mes", label: "Crónicas del mes" },
];

type OrgLimitsRowProps = {
  row: PlatformOrganizationSubscriptionRow;
  isConfirming: boolean;
  pending: boolean;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onSubmit: () => void;
  formAction: (payload: FormData) => void;
};

function OrgLimitsRow({
  row,
  isConfirming,
  pending,
  onStartConfirm,
  onCancelConfirm,
  onSubmit,
  formAction,
}: OrgLimitsRowProps) {
  const [subscriptionTier, setSubscriptionTier] = useState(row.subscriptionTier);

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-3 font-medium">{row.organizationName}</td>
      <td className="px-3 py-3 text-text-secondary">
        {subscriptionTierLabel(row.subscriptionTier)}
      </td>
      <td className="px-3 py-3">
        <ul className="space-y-1 text-xs text-text-secondary">
          {RESOURCE_ROWS.map(({ key, label }) => {
            const atLimit =
              row.limits[key] !== null && row.usage[key] >= (row.limits[key] as number);
            return (
              <li key={key} className={cn(atLimit && "text-warning")}>
                {label}: {formatUsageLabel(row.usage[key], row.limits[key])}
              </li>
            );
          })}
        </ul>
      </td>
      <td className="px-3 py-3">
        <form action={formAction} className="space-y-3" onSubmit={onSubmit}>
          <input type="hidden" name="organizationId" value={row.organizationId} />
          <input type="hidden" name="confirmed" value={isConfirming ? "1" : "0"} />
          <select
            name="subscriptionTier"
            value={subscriptionTier}
            onChange={(event) =>
              setSubscriptionTier(event.target.value as typeof subscriptionTier)
            }
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-2 text-sm"
          >
            {SUBSCRIPTION_TIER_OPTIONS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs">
              <span className="text-text-secondary">+ Torneos</span>
              <input
                name="torneosExtra"
                type="number"
                min={0}
                defaultValue={row.addonOverrides.torneos_extra ?? ""}
                className="min-h-9 w-full rounded-lg border border-border bg-background px-2"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-text-secondary">+ Sedes</span>
              <input
                name="sedesExtra"
                type="number"
                min={0}
                defaultValue={row.addonOverrides.sedes_extra ?? ""}
                className="min-h-9 w-full rounded-lg border border-border bg-background px-2"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-text-secondary">+ Canchas</span>
              <input
                name="canchasExtra"
                type="number"
                min={0}
                defaultValue={row.addonOverrides.canchas_extra ?? ""}
                className="min-h-9 w-full rounded-lg border border-border bg-background px-2"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-text-secondary">+ Staff</span>
              <input
                name="staffExtra"
                type="number"
                min={0}
                defaultValue={row.addonOverrides.usuarios_staff_extra ?? ""}
                className="min-h-9 w-full rounded-lg border border-border bg-background px-2"
              />
            </label>
            <label className="col-span-2 space-y-1 text-xs">
              <span className="text-text-secondary">+ Crónicas/mes</span>
              <input
                name="cronicasExtraMes"
                type="number"
                min={0}
                defaultValue={row.addonOverrides.cronicas_extra_mes ?? ""}
                className="min-h-9 w-full rounded-lg border border-border bg-background px-2"
              />
            </label>
          </div>
          {!isConfirming ? (
            <button
              type="button"
              onClick={onStartConfirm}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-surface-elevated"
            >
              Editar límites…
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
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
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}

type PlatformSubscriptionLimitsPanelProps = {
  rows: PlatformOrganizationSubscriptionRow[];
};

export function PlatformSubscriptionLimitsPanel({
  rows,
}: PlatformSubscriptionLimitsPanelProps) {
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [actionState, formAction, pending] = useActionState(
    setOrganizationSubscriptionLimitsAction,
    initialPlatformSubscriptionActionState
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      row.organizationName.toLowerCase().includes(needle)
    );
  }, [rows, search]);

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Límites operativos por organización
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Asigna tier (Básico / Pro / Premium) y addons manuales. El cobro sigue
          siendo manual; esto solo aplica enforcement en la app.
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
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Organización</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Uso vs límite</th>
              <th className="px-3 py-2 font-medium">Gestión</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-text-secondary">
                  No hay organizaciones con este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const rowKey = row.organizationId;
                return (
                  <OrgLimitsRow
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

      <p className="text-xs text-muted">
        Cuando un recurso alcanza su límite, los usuarios ven el mensaje:{" "}
        {formatLimitReachedMessage("torneos_activos", 1)}
      </p>
    </Card>
  );
}
