import type { MatchOfficialStatus } from "@/lib/matches/types";

export function canConfirmOwnAssignment(
  status: MatchOfficialStatus
): boolean {
  return status === "assigned";
}
