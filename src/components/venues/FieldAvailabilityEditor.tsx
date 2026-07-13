"use client";

import { useMemo, useState, useTransition } from "react";
import { replaceFieldAvailabilityAction } from "@/lib/venues/actions";
import {
  DAY_LABELS_ES,
  type AvailabilityInterval,
} from "@/lib/venues/types";
import { validateAvailabilityIntervals } from "@/lib/venues/availability-validation";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type DraftInterval = {
  key: string;
  starts_at: string;
  ends_at: string;
};

type FieldAvailabilityEditorProps = {
  organizationId: string;
  venueId: string;
  fieldId: string;
  initialIntervals: AvailabilityInterval[];
  canEdit: boolean;
};

function groupByDay(
  intervals: AvailabilityInterval[]
): Record<number, DraftInterval[]> {
  const groups: Record<number, DraftInterval[]> = {};
  for (let d = 0; d < 7; d++) groups[d] = [];
  for (const interval of intervals) {
    groups[interval.day_of_week].push({
      key: interval.id ?? crypto.randomUUID(),
      starts_at: interval.starts_at,
      ends_at: interval.ends_at,
    });
  }
  return groups;
}

export function FieldAvailabilityEditor({
  organizationId,
  venueId,
  fieldId,
  initialIntervals,
  canEdit,
}: FieldAvailabilityEditorProps) {
  const [days, setDays] = useState(() => groupByDay(initialIntervals));
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const enabledDays = useMemo(() => {
    const set = new Set<number>();
    for (let d = 0; d < 7; d++) {
      if (days[d].length > 0) set.add(d);
    }
    return set;
  }, [days]);

  function toggleDay(day: number, enabled: boolean) {
    setDays((prev) => ({
      ...prev,
      [day]: enabled
        ? prev[day].length > 0
          ? prev[day]
          : [{ key: crypto.randomUUID(), starts_at: "07:00", ends_at: "23:00" }]
        : [],
    }));
  }

  function addInterval(day: number) {
    setDays((prev) => ({
      ...prev,
      [day]: [
        ...prev[day],
        { key: crypto.randomUUID(), starts_at: "14:00", ends_at: "22:00" },
      ],
    }));
  }

  function removeInterval(day: number, key: string) {
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].filter((i) => i.key !== key),
    }));
  }

  function updateInterval(
    day: number,
    key: string,
    patch: Partial<DraftInterval>
  ) {
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].map((i) => (i.key === key ? { ...i, ...patch } : i)),
    }));
  }

  function onSave() {
    setMessage(null);
    const intervals = Object.entries(days).flatMap(([day, list]) =>
      list.map((i) => ({
        day_of_week: Number(day),
        starts_at: i.starts_at,
        ends_at: i.ends_at,
      }))
    );

    const validationError = validateAvailabilityIntervals(intervals);
    if (validationError) {
      setOk(false);
      setMessage(validationError);
      return;
    }

    startTransition(async () => {
      const result = await replaceFieldAvailabilityAction({
        organizationId,
        venueId,
        fieldId,
        intervals,
      });
      setOk(result.ok);
      setMessage(result.message);
    });
  }

  if (!canEdit) {
    const hasAny = initialIntervals.length > 0;
    return (
      <Card className="space-y-3">
        <h4 className="text-sm font-semibold text-text-primary">
          Disponibilidad habitual
        </h4>
        {!hasAny && (
          <p className="text-sm text-muted">Sin horarios configurados.</p>
        )}
        {hasAny && (
          <ul className="space-y-1 text-sm text-text-secondary">
            {initialIntervals.map((i) => (
              <li key={`${i.day_of_week}-${i.starts_at}-${i.ends_at}`}>
                {DAY_LABELS_ES[i.day_of_week]} {i.starts_at}–{i.ends_at}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">
          Disponibilidad habitual
        </h4>
        <p className="mt-1 text-xs text-muted">
          Horario semanal base. No son reservas ni partidos.
        </p>
      </div>

      {message && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role={ok ? "status" : "alert"}
        >
          {message}
        </p>
      )}

      <div className="space-y-4">
        {DAY_LABELS_ES.map((label, day) => {
          const enabled = enabledDays.has(day) || days[day].length > 0;
          return (
            <div
              key={day}
              className="rounded-xl border border-border bg-background/40 p-3"
            >
              <label className="flex items-center gap-3 text-sm font-medium text-text-primary">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={pending}
                  onChange={(e) => toggleDay(day, e.target.checked)}
                />
                {label}
              </label>
              {enabled && (
                <div className="mt-3 space-y-2">
                  {days[day].map((interval) => (
                    <div
                      key={interval.key}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <div className="space-y-1">
                        <label className="block text-xs text-muted">Inicio</label>
                        <input
                          type="time"
                          value={interval.starts_at}
                          disabled={pending}
                          onChange={(e) =>
                            updateInterval(day, interval.key, {
                              starts_at: e.target.value,
                            })
                          }
                          className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs text-muted">Fin</label>
                        <input
                          type="time"
                          value={interval.ends_at}
                          disabled={pending}
                          onChange={(e) =>
                            updateInterval(day, interval.key, {
                              ends_at: e.target.value,
                            })
                          }
                          className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => removeInterval(day, interval.key)}
                        className={cn(
                          "min-h-11 rounded-xl border border-border px-3 text-sm text-text-secondary",
                          "hover:text-text-primary"
                        )}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => addInterval(day)}
                    className="text-sm font-medium text-organization-accent"
                  >
                    Añadir intervalo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Procesando…" : "Guardar disponibilidad"}
      </button>
    </Card>
  );
}
