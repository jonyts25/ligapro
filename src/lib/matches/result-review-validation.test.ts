import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveReviewPhase,
  formatReviewCountdown,
} from "@/lib/matches/result-review-validation";

describe("result review validation", () => {
  it("derives pending phase for unapproved closed match", () => {
    assert.equal(
      deriveReviewPhase({
        matchStatus: "finished",
        approvedAt: null,
        reviewOpenedAt: "2026-09-27T12:00:00Z",
        hasOpenDispute: false,
      }),
      "pending"
    );
  });

  it("derives disputed phase when open dispute exists", () => {
    assert.equal(
      deriveReviewPhase({
        matchStatus: "walkover",
        approvedAt: null,
        reviewOpenedAt: "2026-09-27T12:00:00Z",
        hasOpenDispute: true,
      }),
      "disputed"
    );
  });

  it("derives approved phase", () => {
    assert.equal(
      deriveReviewPhase({
        matchStatus: "finished",
        approvedAt: "2026-09-28T12:00:00Z",
        reviewOpenedAt: "2026-09-27T12:00:00Z",
        hasOpenDispute: false,
      }),
      "approved"
    );
  });

  it("returns not_applicable for scheduled matches", () => {
    assert.equal(
      deriveReviewPhase({
        matchStatus: "scheduled",
        approvedAt: null,
        reviewOpenedAt: null,
        hasOpenDispute: false,
      }),
      "not_applicable"
    );
  });

  it("formats countdown until auto-close", () => {
    const now = Date.parse("2026-09-27T12:00:00Z");
    assert.equal(
      formatReviewCountdown("2026-09-27T13:30:00Z", now),
      "1 h 30 min restantes"
    );
    assert.equal(
      formatReviewCountdown("2026-09-27T12:10:00Z", now),
      "10 min restantes"
    );
    assert.equal(
      formatReviewCountdown("2026-09-27T11:00:00Z", now),
      "Autocierre pendiente"
    );
  });
});
