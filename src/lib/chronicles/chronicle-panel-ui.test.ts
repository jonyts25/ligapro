import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldShowChronicleElaborationMessage,
  shouldShowChronicleGenerateButton,
} from "@/lib/chronicles/chronicle-panel-ui";

describe("MatchChroniclePanel UI rules", () => {
  it("shows elaboration message while result is not official", () => {
    assert.equal(
      shouldShowChronicleElaborationMessage({
        matchFinished: true,
        resultApproved: false,
        chronicle: null,
        job: null,
      }),
      true
    );
    assert.equal(
      shouldShowChronicleGenerateButton({
        canManage: true,
        resultApproved: false,
        chronicle: null,
        job: null,
      }),
      false
    );
  });

  it("shows elaboration message after approval until job or chronicle exists", () => {
    assert.equal(
      shouldShowChronicleElaborationMessage({
        matchFinished: true,
        resultApproved: true,
        chronicle: null,
        job: null,
      }),
      true
    );
    assert.equal(
      shouldShowChronicleGenerateButton({
        canManage: true,
        resultApproved: true,
        chronicle: null,
        job: null,
      }),
      false
    );
  });

  it("shows generate button once chronicle exists and result is official", () => {
    assert.equal(
      shouldShowChronicleGenerateButton({
        canManage: true,
        resultApproved: true,
        chronicle: {
          id: "c1",
          matchId: "m1",
          content: "Texto",
          tier: "basico",
          isPublished: false,
          generatedAt: "2026-01-01T00:00:00Z",
          modelUsed: "claude",
        },
        job: null,
      }),
      true
    );
  });
});
