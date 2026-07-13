/** Half-open interval overlap: [start, end) — contiguous times do not overlap. */
export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && startB < endA;
}

export function validateAvailabilityIntervals(
  intervals: Array<{ day_of_week: number; starts_at: string; ends_at: string }>
): string | null {
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

  for (const interval of intervals) {
    if (
      !Number.isInteger(interval.day_of_week) ||
      interval.day_of_week < 0 ||
      interval.day_of_week > 6
    ) {
      return "Hay un día inválido.";
    }
    if (!timeRe.test(interval.starts_at) || !timeRe.test(interval.ends_at)) {
      return "Las horas deben tener el formato HH:MM.";
    }
    if (interval.ends_at <= interval.starts_at) {
      return "La hora final debe ser posterior a la inicial.";
    }
  }

  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];
      if (
        a.day_of_week === b.day_of_week &&
        intervalsOverlap(a.starts_at, a.ends_at, b.starts_at, b.ends_at)
      ) {
        return "Hay intervalos solapados o duplicados el mismo día.";
      }
    }
  }

  return null;
}
