import type { MatchResultReviewStatus } from "@/lib/matches/result-review-types";

export function deriveReviewPhase(input: {
  matchStatus: string;
  approvedAt: string | null;
  reviewOpenedAt: string | null;
  hasOpenDispute: boolean;
}): MatchResultReviewStatus["phase"] {
  const closed =
    input.matchStatus === "finished" || input.matchStatus === "walkover";
  if (!closed) return "not_applicable";
  if (input.approvedAt) return "approved";
  if (input.hasOpenDispute) return "disputed";
  if (input.reviewOpenedAt) return "pending";
  return "not_applicable";
}

export function formatAutoCloseLabel(autoCloseAt: string | null): string | null {
  if (!autoCloseAt) return null;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(autoCloseAt));
}

export function formatReviewCountdown(autoCloseAt: string | null, nowMs: number): string | null {
  if (!autoCloseAt) return null;
  const target = new Date(autoCloseAt).getTime();
  const diffMs = target - nowMs;
  if (diffMs <= 0) return "Autocierre pendiente";
  const totalMinutes = Math.ceil(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours} h ${minutes} min restantes`;
  }
  return `${minutes} min restantes`;
}
