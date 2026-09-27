import { FIXTURE_TIMEZONE } from "@/lib/fixtures/types";

export type LiveMatchdayAlertId =
  | "no_confirmed_referee"
  | "result_not_captured"
  | "open_dispute"
  | "pending_approval"
  | "roster_not_validated";

export type LiveMatchdayAlert = {
  id: LiveMatchdayAlertId;
  label: string;
};

const ALERT_LABELS: Record<LiveMatchdayAlertId, string> = {
  no_confirmed_referee: "Sin árbitro confirmado",
  result_not_captured: "Resultado pendiente de captura",
  open_dispute: "Disputa abierta",
  pending_approval: "Pendiente de aprobación",
  roster_not_validated: "Plantel sin validar",
};

/** Default: today in America/Mexico_City as YYYY-MM-DD. */
export function getMexicoCityDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FIXTURE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shiftMexicoCityDateString(
  dateString: string,
  dayDelta: number
): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const utcGuess = Date.UTC(year!, month! - 1, day! + dayDelta, 12, 0, 0);
  return getMexicoCityDateString(new Date(utcGuess));
}

export function buildLiveMatchdayAlerts(input: {
  startsAt: string | null;
  status: string;
  hasConfirmedReferee: boolean;
  hasOpenDispute: boolean;
  isResultOfficial: boolean;
  homeValidatedCount: number;
  awayValidatedCount: number;
  matchDurationMinutes: number;
  nowMs?: number;
  refereeLeadMinutes?: number;
}): LiveMatchdayAlert[] {
  const nowMs = input.nowMs ?? Date.now();
  const leadMs = (input.refereeLeadMinutes ?? 30) * 60_000;
  const alerts: LiveMatchdayAlertId[] = [];

  const startsMs = input.startsAt ? new Date(input.startsAt).getTime() : NaN;
  const hasStart = Number.isFinite(startsMs);
  const durationMs = Math.max(1, input.matchDurationMinutes) * 60_000;
  const endedMs = hasStart ? startsMs + durationMs : NaN;

  if (
    hasStart &&
    !input.hasConfirmedReferee &&
    nowMs >= startsMs - leadMs
  ) {
    alerts.push("no_confirmed_referee");
  }

  if (
    hasStart &&
    input.status === "scheduled" &&
    Number.isFinite(endedMs) &&
    nowMs >= endedMs
  ) {
    alerts.push("result_not_captured");
  }

  if (input.hasOpenDispute) {
    alerts.push("open_dispute");
  }

  if (
    !input.isResultOfficial &&
    !input.hasOpenDispute &&
    (input.status === "finished" || input.status === "walkover")
  ) {
    alerts.push("pending_approval");
  }

  if (
    hasStart &&
    nowMs >= startsMs &&
    input.homeValidatedCount === 0 &&
    input.awayValidatedCount === 0
  ) {
    alerts.push("roster_not_validated");
  }

  return alerts.map((id) => ({ id, label: ALERT_LABELS[id] }));
}
