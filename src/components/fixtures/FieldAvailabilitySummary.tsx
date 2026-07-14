type FieldAvailabilitySummaryProps = {
  intervals: Array<{ startsAt: string; endsAt: string }>;
  emptyMessage?: string;
};

export function FieldAvailabilitySummary({
  intervals,
  emptyMessage = "Configura primero la disponibilidad habitual de esta cancha.",
}: FieldAvailabilitySummaryProps) {
  if (!intervals.length) {
    return (
      <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text-secondary">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border px-3 py-2 text-sm text-text-secondary">
      <p className="mb-1 font-medium text-text-primary">
        Disponibilidad del día
      </p>
      <ul className="space-y-1">
        {intervals.map((interval) => (
          <li key={`${interval.startsAt}-${interval.endsAt}`}>
            {interval.startsAt} – {interval.endsAt}
          </li>
        ))}
      </ul>
    </div>
  );
}
