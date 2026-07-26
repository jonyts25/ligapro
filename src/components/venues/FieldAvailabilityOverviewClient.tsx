"use client";

import { useRouter } from "next/navigation";
import { FieldAvailabilityOverviewPanel } from "@/components/venues/FieldAvailabilityOverviewPanel";
import type { FieldAvailabilityOverview } from "@/lib/venues/availability-overview";
import { Card } from "@/components/ui/Card";

type FieldAvailabilityOverviewClientProps = {
  organizationId: string;
  fields: Array<{ id: string; label: string }>;
  selectedFieldId: string;
  weekStart: string;
  overview: FieldAvailabilityOverview | null;
};

export function FieldAvailabilityOverviewClient({
  organizationId,
  fields,
  selectedFieldId,
  weekStart,
  overview,
}: FieldAvailabilityOverviewClientProps) {
  const router = useRouter();

  function navigate(fieldId: string, week: string) {
    const params = new URLSearchParams();
    if (fieldId) params.set("fieldId", fieldId);
    if (week) params.set("weekStart", week);
    router.push(
      `/organizaciones/${organizationId}/sedes/disponibilidad?${params.toString()}`
    );
  }

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="fieldId" className="block text-sm font-medium">
            Cancha
          </label>
          <select
            id="fieldId"
            value={selectedFieldId}
            onChange={(e) => navigate(e.target.value, weekStart)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="weekStart" className="block text-sm font-medium">
            Inicio de semana
          </label>
          <input
            id="weekStart"
            type="date"
            value={weekStart}
            onChange={(e) => navigate(selectedFieldId, e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
      </Card>

      {overview ? (
        <FieldAvailabilityOverviewPanel
          fieldName={overview.fieldName}
          venueName={overview.venueName}
          weekStart={overview.weekStart}
          weekEnd={overview.weekEnd}
          slots={overview.slots}
        />
      ) : (
        <Card>
          <p className="text-sm text-muted">Selecciona una cancha válida.</p>
        </Card>
      )}
    </div>
  );
}
