import type { AvailabilityOverviewSlot } from "@/lib/venues/availability-overview";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

type FieldAvailabilityOverviewPanelProps = {
  fieldName: string;
  venueName: string;
  weekStart: string;
  weekEnd: string;
  slots: AvailabilityOverviewSlot[];
};

function slotVariant(
  kind: AvailabilityOverviewSlot["kind"]
): "default" | "success" | "warning" | "danger" {
  switch (kind) {
    case "availability":
      return "success";
    case "season_block":
      return "warning";
    case "reservation":
      return "danger";
    default:
      return "default";
  }
}

export function FieldAvailabilityOverviewPanel({
  fieldName,
  venueName,
  weekStart,
  weekEnd,
  slots,
}: FieldAvailabilityOverviewPanelProps) {
  const grouped = slots.reduce<Record<string, AvailabilityOverviewSlot[]>>(
    (acc, slot) => {
      acc[slot.dayLabel] = acc[slot.dayLabel] ?? [];
      acc[slot.dayLabel].push(slot);
      return acc;
    },
    {}
  );

  return (
    <Card className="space-y-4">
      <SectionHeader
        title={`${venueName} · ${fieldName}`}
        description={`Semana ${weekStart} — ${weekEnd} · Solo consulta`}
      />
      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-muted">
          Sin horarios habituales, bloqueos ni reservas en esta semana.
        </p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dayLabel, daySlots]) => (
            <div key={dayLabel} className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">
                {dayLabel}
              </h3>
              <ul className="space-y-2">
                {daySlots.map((slot, index) => (
                  <li
                    key={`${slot.kind}-${slot.startsAt}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {slot.startsAt}–{slot.endsAt}
                      </p>
                      {slot.detail && (
                        <p className="text-xs text-muted">{slot.detail}</p>
                      )}
                    </div>
                    <StatusBadge
                      label={slot.label}
                      variant={slotVariant(slot.kind)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
