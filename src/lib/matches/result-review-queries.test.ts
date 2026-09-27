import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveReviewPhase } from "@/lib/matches/result-review-validation";
import type { MatchResultReviewStatus } from "@/lib/matches/result-review-types";

function buildReviewStatus(input: {
  phase: MatchResultReviewStatus["phase"];
  canOpenDispute?: boolean;
  canApproveResult?: boolean;
}): MatchResultReviewStatus {
  return {
    phase: input.phase,
    reviewOpenedAt: "2026-09-27T12:00:00Z",
    autoCloseAt: "2026-09-28T12:00:00Z",
    approvedAt: input.phase === "approved" ? "2026-09-28T10:00:00Z" : null,
    approvedByProfileId: null,
    openDispute:
      input.phase === "disputed"
        ? {
            id: "dispute-1",
            reason: "Marcador incorrecto",
            openedByProfileId: "captain-1",
            openedByDisplayName: "Capitán Local",
            seasonTeamId: "team-1",
            createdAt: "2026-09-27T13:00:00Z",
          }
        : null,
    canOpenDispute: input.canOpenDispute ?? false,
    canApproveResult: input.canApproveResult ?? false,
  };
}

describe("result review status model", () => {
  it("maps pending review to captain dispute eligibility", () => {
    const status = buildReviewStatus({
      phase: "pending",
      canOpenDispute: true,
      canApproveResult: false,
    });

    assert.equal(status.phase, "pending");
    assert.equal(status.openDispute, null);
    assert.equal(status.canOpenDispute, true);
  });

  it("maps disputed review with open dispute payload", () => {
    const status = buildReviewStatus({ phase: "disputed" });

    assert.equal(status.openDispute?.reason, "Marcador incorrecto");
    assert.equal(
      deriveReviewPhase({
        matchStatus: "finished",
        approvedAt: null,
        reviewOpenedAt: status.reviewOpenedAt,
        hasOpenDispute: true,
      }),
      "disputed"
    );
  });

  it("maps approved review without dispute actions", () => {
    const status = buildReviewStatus({ phase: "approved" });

    assert.ok(status.approvedAt);
    assert.equal(status.canOpenDispute, false);
    assert.equal(status.canApproveResult, false);
  });
});
