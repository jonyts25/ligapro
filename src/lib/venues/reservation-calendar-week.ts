import { addDaysIso, todayMexicoCityIso } from "@/lib/fixtures/open-slots";
import { localMexicoCityToTimestamptz } from "@/lib/fixtures/timezone";
import { DAY_LABELS_ES } from "@/lib/venues/types";

const WEEK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidWeekDate(value: string): boolean {
  return WEEK_DATE_PATTERN.test(value);
}

export function getWeekStartMexicoCityIso(now = new Date()): string {
  const today = todayMexicoCityIso(now);
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function resolveWeekStartParam(weekParam?: string | null): string {
  if (weekParam && isValidWeekDate(weekParam)) {
    return weekParam;
  }
  return getWeekStartMexicoCityIso();
}

export function getWeekEnd(weekStart: string): string {
  return addDaysIso(weekStart, 6);
}

export function shiftWeekStart(weekStart: string, weeks: number): string {
  return addDaysIso(weekStart, weeks * 7);
}

export function dayOfWeekFromIso(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function formatCalendarDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = dayOfWeekFromIso(isoDate);
  const formatted = date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
  return `${DAY_LABELS_ES[dow]} ${formatted}`;
}

export function getWeekRangeBounds(weekStart: string): {
  rangeStartIso: string;
  rangeEndIso: string;
} {
  const rangeStartIso = localMexicoCityToTimestamptz(weekStart, "00:00");
  const rangeEndIso = localMexicoCityToTimestamptz(
    addDaysIso(weekStart, 7),
    "00:00"
  );

  if (!rangeStartIso || !rangeEndIso) {
    throw new Error("Invalid week range");
  }

  return { rangeStartIso, rangeEndIso };
}
