import type { MatchDisciplineItem } from "@/lib/matches/types";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

function typeLabel(value: string): string {
  if (value === "direct_red") return "Roja directa";
  if (value === "accumulation") return "Acumulación";
  if (value === "administrative") return "Administrativa";
  return value;
}

export function MatchDisciplineSummary({
  items,
}: {
  items: MatchDisciplineItem[];
}) {
  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold">Suspensiones (este partido)</h2>
      {!items.length ? (
        <EmptyState
          title="Sin suspensiones"
          description="Las tarjetas pueden generar suspensiones automáticamente."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.playerName}</span>
                <StatusBadge
                  label={typeLabel(item.suspensionType)}
                  variant="warning"
                />
                <StatusBadge
                  label={item.status}
                  variant={item.status === "active" ? "danger" : "default"}
                />
              </div>
              <p className="mt-1 text-text-secondary">
                Restan {item.matchesRemaining} partido
                {item.matchesRemaining === 1 ? "" : "s"} · cumplidos{" "}
                {item.matchesServed}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
