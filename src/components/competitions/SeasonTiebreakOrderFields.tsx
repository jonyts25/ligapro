"use client";

import { useState } from "react";
import {
  DEFAULT_TIEBREAK_ORDER,
  moveTiebreakItem,
  normalizeTiebreakOrder,
  TIEBREAK_LABELS,
  type TiebreakCriterion,
} from "@/lib/competitions/tiebreak-order";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type SeasonTiebreakOrderFieldsProps = {
  initialOrder?: readonly string[] | null;
  pending?: boolean;
  error?: string;
};

export function SeasonTiebreakOrderFields({
  initialOrder,
  pending = false,
  error,
}: SeasonTiebreakOrderFieldsProps) {
  const [order, setOrder] = useState<TiebreakCriterion[]>(() =>
    normalizeTiebreakOrder(initialOrder ?? DEFAULT_TIEBREAK_ORDER)
  );

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <SectionHeader
        title="Desempates en la tabla"
        description="Orden de criterios después de los puntos. El primero de la lista tiene prioridad."
      />

      <input type="hidden" name="tiebreakOrder" value={JSON.stringify(order)} />

      <ol className="space-y-2">
        {order.map((criterion, index) => (
          <li
            key={criterion}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2"
          >
            <span className="text-sm font-medium text-text-primary">
              {index + 1}. {TIEBREAK_LABELS[criterion]}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={pending || index === 0}
                onClick={() => setOrder((prev) => moveTiebreakItem(prev, index, "up"))}
                className={cn(
                  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border text-sm",
                  index === 0
                    ? "cursor-not-allowed text-muted"
                    : "hover:bg-surface-elevated"
                )}
                aria-label={`Subir ${TIEBREAK_LABELS[criterion]}`}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={pending || index === order.length - 1}
                onClick={() =>
                  setOrder((prev) => moveTiebreakItem(prev, index, "down"))
                }
                className={cn(
                  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border text-sm",
                  index === order.length - 1
                    ? "cursor-not-allowed text-muted"
                    : "hover:bg-surface-elevated"
                )}
                aria-label={`Bajar ${TIEBREAK_LABELS[criterion]}`}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
