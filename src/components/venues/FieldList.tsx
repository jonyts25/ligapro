"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { FieldForm } from "@/components/venues/FieldForm";
import { FieldAvailabilityEditor } from "@/components/venues/FieldAvailabilityEditor";
import { TierLimitButton, TierLimitNotice } from "@/components/billing/TierLimitControls";
import { DAY_LABELS_ES, type FieldWithAvailability } from "@/lib/venues/types";
import { EmptyState } from "@/components/ui/EmptyState";

type FieldListProps = {
  organizationId: string;
  fields: FieldWithAvailability[];
  canManage: boolean;
  canchasAtLimit?: boolean;
  canchasLimitMessage?: string | null;
};

/** @deprecated Legacy venue-scoped list — use FieldCardGrid on /canchas */
export function FieldList({
  organizationId,
  fields,
  canManage,
  canchasAtLimit = false,
  canchasLimitMessage = null,
}: FieldListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Canchas</h2>
        {canManage && (
          <TierLimitButton
            disabled={canchasAtLimit}
            disabledReason={canchasLimitMessage}
            onClick={() => {
              if (canchasAtLimit) return;
              setShowCreate((v) => !v);
              setEditingId(null);
            }}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            {showCreate ? "Cerrar formulario" : "Agregar cancha"}
          </TierLimitButton>
        )}
      </div>

      <TierLimitNotice message={canchasAtLimit ? canchasLimitMessage : null} />

      {canManage && showCreate && (
        <FieldForm organizationId={organizationId} mode="create" />
      )}

      {fields.length === 0 && !showCreate && (
        <EmptyState
          title="Sin canchas"
          description="Registra las canchas donde jugarán tus ligas."
          action={
            canManage ? (
              <TierLimitButton
                disabled={canchasAtLimit}
                disabledReason={canchasLimitMessage}
                onClick={() => setShowCreate(true)}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Agregar cancha
              </TierLimitButton>
            ) : undefined
          }
        />
      )}

      <ul className="space-y-4">
        {fields.map((field) => (
          <li key={field.id}>
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {field.name}
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {field.surface_type ?? "Superficie no indicada"}
                  </p>
                </div>
                <StatusBadge
                  label={field.is_active ? "Activa" : "Inactiva"}
                  variant={field.is_active ? "success" : "warning"}
                />
              </div>

              <p className="text-sm text-text-secondary">
                Disponibilidad:{" "}
                {field.intervals.length === 0
                  ? "sin horarios"
                  : field.intervals
                      .map(
                        (i) =>
                          `${DAY_LABELS_ES[i.day_of_week]} ${i.starts_at}–${i.ends_at}`
                      )
                      .join(" · ")}
              </p>

              {canManage && (
                <button
                  type="button"
                  onClick={() =>
                    setEditingId((id) => (id === field.id ? null : field.id))
                  }
                  className="text-sm font-medium text-organization-accent"
                >
                  {editingId === field.id ? "Cerrar edición" : "Editar"}
                </button>
              )}

              {canManage && editingId === field.id && (
                <div className="space-y-4 border-t border-border pt-4">
                  <FieldForm
                    organizationId={organizationId}
                    mode="edit"
                    field={field}
                    onCancelEdit={() => setEditingId(null)}
                  />
                  <FieldAvailabilityEditor
                    organizationId={organizationId}
                    fieldId={field.id}
                    initialIntervals={field.intervals}
                    canEdit
                  />
                </div>
              )}

              {!canManage && (
                <FieldAvailabilityEditor
                  organizationId={organizationId}
                  fieldId={field.id}
                  initialIntervals={field.intervals}
                  canEdit={false}
                />
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
