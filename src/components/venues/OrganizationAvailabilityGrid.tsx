"use client";

import { useState } from "react";
import {
  blockColorClass,
  type AvailabilityGridBlockCell,
  type OrganizationAvailabilityGridModel,
} from "@/lib/venues/organization-availability-grid";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type OrganizationAvailabilityGridProps = {
  model: OrganizationAvailabilityGridModel;
};

function BlockPopover({
  blocks,
  onClose,
}: {
  blocks: AvailabilityGridBlockCell[];
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-20 min-w-56 rounded-xl border border-border bg-background p-3 shadow-lg"
      role="dialog"
      aria-label="Detalle del bloqueo"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 text-xs text-muted hover:text-text-primary"
      >
        Cerrar
      </button>
      <div className="space-y-3 pr-6">
        {blocks.map((block) => (
          <div key={block.blockId} className="space-y-1 text-sm">
            <p className="font-semibold">{block.competitionName}</p>
            <p className="text-text-secondary">{block.seasonName}</p>
            <p className="text-xs text-muted">
              {block.dayLabel} · {block.startsAt}–{block.endsAt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrganizationAvailabilityGrid({
  model,
}: OrganizationAvailabilityGridProps) {
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);

  return (
    <Card className="space-y-4 overflow-hidden">
      <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-success/40 bg-success/10" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-warning/40 bg-warning/20" />
          Bloqueo de torneo
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-border bg-muted/20" />
          Sin configurar
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-10 min-w-36 border border-border bg-surface px-3 py-2 text-left font-medium"
              >
                Cancha
              </th>
              {model.dayColumns.map((day) => (
                <th
                  key={day.dayOfWeek}
                  colSpan={model.hourSlots.length}
                  className="border border-border bg-surface-elevated px-2 py-2 text-center font-medium"
                >
                  {day.label}
                </th>
              ))}
            </tr>
            <tr>
              {model.dayColumns.flatMap((day) =>
                model.hourSlots.map((hour) => (
                  <th
                    key={`${day.dayOfWeek}-${hour}`}
                    className="min-w-16 border border-border bg-surface px-1 py-1 text-center font-normal text-muted"
                  >
                    {String(hour).padStart(2, "0")}:00
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {model.rows.map(({ field, cells }) => (
              <tr key={field.fieldId}>
                <td className="sticky left-0 z-10 border border-border bg-background px-3 py-2 font-medium">
                  <div>{field.fieldName}</div>
                  {!field.hasWeeklyAvailability && (
                    <div className="text-[11px] font-normal text-muted">
                      Sin configurar
                    </div>
                  )}
                </td>
                {cells.map((cell) => {
                  const cellKey = `${field.fieldId}-${cell.dayOfWeek}-${cell.hour}`;
                  const isBlocked = cell.kind === "blocked";

                  return (
                    <td
                      key={cellKey}
                      className="relative border border-border p-0"
                    >
                      <button
                        type="button"
                        disabled={!isBlocked}
                        onClick={() =>
                          setActiveCellKey((current) =>
                            current === cellKey ? null : cellKey
                          )
                        }
                        className={cn(
                          "flex min-h-10 w-full items-center justify-center px-1 py-2 text-[10px] leading-tight",
                          cell.kind === "unconfigured" &&
                            "bg-muted/20 text-muted",
                          cell.kind === "outside_hours" && "bg-background",
                          cell.kind === "available" && "bg-success/10",
                          cell.kind === "blocked" &&
                            cn(
                              "cursor-pointer font-medium",
                              blockColorClass(cell.blocks[0]?.competitionId ?? "")
                            )
                        )}
                        title={
                          isBlocked
                            ? cell.blocks
                                .map((b) => b.competitionName)
                                .join(", ")
                            : undefined
                        }
                      >
                        {cell.kind === "unconfigured" && "—"}
                        {cell.kind === "blocked" &&
                          cell.blocks[0]?.competitionName.slice(0, 12)}
                      </button>
                      {activeCellKey === cellKey && isBlocked && (
                        <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2">
                          <BlockPopover
                            blocks={cell.blocks}
                            onClose={() => setActiveCellKey(null)}
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
