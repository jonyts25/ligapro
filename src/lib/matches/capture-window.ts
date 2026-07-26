const CAPTURE_TIMEZONE = "America/Mexico_City";

/** Mirrors DB helper __match_capture_window_open for UI display only. */
export function isCaptureWindowOpen(startsAt: string | null | undefined): boolean {
  if (!startsAt) return false;

  const startMs = new Date(startsAt).getTime();
  if (Number.isNaN(startMs)) return false;

  const nowMs = Date.now();
  const windowEndMs = captureWindowEndMs(startsAt);
  return nowMs >= startMs && nowMs < windowEndMs;
}

function captureWindowEndMs(startsAt: string): number {
  const localDate = mexicoCityDateParts(new Date(startsAt));
  const nextDay = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + 1));
  const nextParts = mexicoCityDateParts(nextDay);
  return zonedDateTimeToUtcMs(
    nextParts.year,
    nextParts.month,
    nextParts.day,
    9,
    0
  );
}

function mexicoCityDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAPTURE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

function zonedDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const offsetMinutes = mexicoCityOffsetMinutes(new Date(guess));
    const adjusted = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60_000;
    if (adjusted === guess) break;
    guess = adjusted;
  }
  return guess;
}

function mexicoCityOffsetMinutes(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CAPTURE_TIMEZONE,
    timeZoneName: "shortOffset",
  });
  const tz = formatter.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  const match = tz.match(/GMT([+-]\d+)/);
  if (!match) return 0;
  return Number(match[1]) * 60;
}
