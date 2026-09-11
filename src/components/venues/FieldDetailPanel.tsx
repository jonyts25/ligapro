"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { FieldAvailabilityEditor } from "@/components/venues/FieldAvailabilityEditor";
import { DAY_LABELS_ES, type FieldDetail } from "@/lib/venues/types";

type FieldDetailPanelProps = {
  organizationId: string;
  field: FieldDetail;
  canManage: boolean;
};

export function FieldDetailPanel({
  organizationId,
  field,
  canManage,
}: FieldDetailPanelProps) {
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{field.name}</h2>
            {field.address && (
              <p className="text-sm text-text-secondary">{field.address}</p>
            )}
            {field.surface_type && (
              <p className="text-sm text-muted">{field.surface_type}</p>
            )}
          </div>
          <StatusBadge
            label={field.is_active ? "Activa" : "Inactiva"}
            variant={field.is_active ? "success" : "warning"}
          />
        </div>
        {canManage && (
          <Link
            href={`/organizaciones/${organizationId}/canchas/${field.id}/editar`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Editar cancha
          </Link>
        )}
      </Card>

      <FieldAvailabilityEditor
        organizationId={organizationId}
        fieldId={field.id}
        initialIntervals={field.intervals}
        canEdit={canManage}
      />

      {field.intervals.length > 0 && (
        <Card className="space-y-2">
          <h3 className="text-sm font-semibold">Resumen semanal</h3>
          <ul className="space-y-1 text-sm text-text-secondary">
            {field.intervals.map((interval) => (
              <li key={interval.id ?? `${interval.day_of_week}-${interval.starts_at}`}>
                {DAY_LABELS_ES[interval.day_of_week]} · {interval.starts_at}–
                {interval.ends_at}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
