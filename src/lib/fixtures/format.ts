import { FIXTURE_TIMEZONE } from "@/lib/fixtures/types";

export function formatMatchDateTime(iso: string | null): string {
  if (!iso) return "Sin programación";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: FIXTURE_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function addMinutesToLocalPreview(
  dateISO: string,
  timeHHMM: string,
  minutes: number
): string {
  if (!dateISO || !timeHHMM || minutes <= 0) return "—";
  const [h, m] = timeHHMM.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}
