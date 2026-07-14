/** Convert Mexico City local date+time to ISO timestamptz. */
export function localMexicoCityToTimestamptz(
  dateISO: string,
  timeHHMM: string
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeHHMM)) return null;

  const target = `${dateISO}T${timeHHMM}`;
  let lo = Date.parse(`${dateISO}T00:00:00.000Z`) - 12 * 3600_000;
  let hi = Date.parse(`${dateISO}T00:00:00.000Z`) + 36 * 3600_000;

  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(mid));
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const local = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
    if (local === target) {
      return new Date(mid).toISOString();
    }
    if (local < target) lo = mid + 60_000;
    else hi = mid - 60_000;
  }
  return null;
}
