"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cancelFieldReservationAction } from "@/lib/venues/reservation-actions";
import { initialReservationActionState } from "@/lib/venues/types";
import type { ReservationCalendarBlockCell } from "@/lib/venues/reservation-calendar-model";
import type { ReservationCalendarModel } from "@/lib/venues/reservation-calendar-model";
import { reservationTypeVisual } from "@/lib/venues/reservation-types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type ReservationCalendarGridProps = {
  organizationId: string;
  model: ReservationCalendarModel;
};

function ReservationPopover({
  reservation,
  organizationId,
  onClose,
}: {
  reservation: ReservationCalendarBlockCell;
  organizationId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    cancelFieldReservationAction,
    initialReservationActionState
  );
  const visual = reservationTypeVisual(reservation.reservationType);
  const blockTitle =
    reservation.displayLabel || visual.label || reservation.fieldName;

  return (
    <div
      className="absolute z-20 min-w-64 rounded-xl border border-border bg-background p-3 shadow-lg"
      role="dialog"
      aria-label="Detalle de reserva"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 text-xs text-muted hover:text-text-primary"
      >
        Cerrar
      </button>

      <div className="space-y-3 pr-6">
        <div>
          <p className="text-sm font-semibold">{blockTitle}</p>
          <p className="text-xs text-text-secondary">{visual.label}</p>
          <p className="mt-1 text-xs text-muted">
            {reservation.dayLabel} · {reservation.startsAtLabel}–
            {reservation.endsAtLabel}
          </p>
        </div>

        {state.message && (
          <p
            className={cn(
              "rounded-lg border px-2 py-1.5 text-xs",
              state.ok
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger"
            )}
          >
            {state.message}
          </p>
        )}

        {reservation.reservationType === "match" && reservation.matchHref ? (
          <Link
            href={reservation.matchHref}
            className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-medium"
          >
            Ver partido
          </Link>
        ) : reservation.canCancel ? (
          <form action={formAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="reservationId" value={reservation.id} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-9 items-center rounded-lg border border-danger/40 px-3 text-xs font-medium text-danger"
            >
              {pending ? "Cancelando…" : "Cancelar"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function ReservationCalendarGrid({
  organizationId,
  model,
}: ReservationCalendarGridProps) {
  const [activeReservationId, setActiveReservationId] = useState<string | null>(
    null
  );

  return (
    <Card className="space-y-4 overflow-hidden">
      <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
        {(["maintenance", "private_rental", "closed", "manual_block", "match"] as const).map(
          (type) => {
            const visual = reservationTypeVisual(type);
            return (
              <span key={type} className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "h-3 w-3 rounded border",
                    visual.cellClass.split(" ").slice(0, 2).join(" ")
                  )}
                />
                {visual.label}
              </span>
            );
          }
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-10 min-w-40 border border-border bg-surface px-3 py-2 text-left font-medium"
              >
                Cancha
              </th>
              {model.dayColumns.map((day) => (
                <th
                  key={day.dayDate}
                  colSpan={model.hourSlots.length}
                  className="border border-border bg-surface-elevated px-2 py-2 text-center font-medium"
                >
                  {day.dayLabel}
                </th>
              ))}
            </tr>
            <tr>
              {model.dayColumns.flatMap((day) =>
                model.hourSlots.map((hour) => (
                  <th
                    key={`${day.dayDate}-${hour}`}
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
                  <div>{field.fieldLabel}</div>
                  {!field.isActive && (
                    <div className="text-[11px] font-normal text-muted">
                      Inactiva
                    </div>
                  )}
                </td>
                {cells.map((cell) => {
                  const cellKey = `${field.fieldId}-${cell.dayDate}-${cell.hour}`;
                  const reservation = cell.reservations[0] ?? null;
                  const visual = reservation
                    ? reservationTypeVisual(reservation.reservationType)
                    : null;
                  const label =
                    reservation?.displayLabel ||
                    visual?.label ||
                    "";

                  return (
                    <td
                      key={cellKey}
                      className="relative border border-border p-0"
                    >
                      <button
                        type="button"
                        disabled={!reservation}
                        onClick={() =>
                          setActiveReservationId((current) =>
                            reservation &&
                            current === reservation.id
                              ? null
                              : reservation?.id ?? null
                          )
                        }
                        className={cn(
                          "flex min-h-10 w-full items-center justify-center px-1 py-2 text-[10px] leading-tight",
                          reservation
                            ? cn(
                                "cursor-pointer border font-medium",
                                visual?.cellClass
                              )
                            : "bg-background"
                        )}
                        title={label || undefined}
                      >
                        {reservation && label.slice(0, 14)}
                      </button>
                      {reservation &&
                        activeReservationId === reservation.id && (
                          <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2">
                            <ReservationPopover
                              reservation={reservation}
                              organizationId={organizationId}
                              onClose={() => setActiveReservationId(null)}
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
