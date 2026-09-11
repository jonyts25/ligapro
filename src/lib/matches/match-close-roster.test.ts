import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { humanizeCaptureError } from "@/lib/matches/capture-errors";
import {
  MATCH_CLOSE_ROSTER_RPC_ERROR,
  MATCH_CLOSE_ROSTER_USER_MESSAGE,
  validateMatchCloseRoster,
} from "@/lib/matches/match-close-roster";

describe("validateMatchCloseRoster", () => {
  it("rejects closing when both teams have zero active players", () => {
    const result = validateMatchCloseRoster({
      homeActiveCount: 0,
      awayActiveCount: 0,
      targetStatus: "finished",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, MATCH_CLOSE_ROSTER_RPC_ERROR);
    }
  });

  it("rejects walkover when both teams have zero active players", () => {
    const result = validateMatchCloseRoster({
      homeActiveCount: 0,
      awayActiveCount: 0,
      targetStatus: "walkover",
    });

    assert.equal(result.ok, false);
  });

  it("allows closing when home has at least one active player", () => {
    const result = validateMatchCloseRoster({
      homeActiveCount: 1,
      awayActiveCount: 0,
      targetStatus: "finished",
    });

    assert.deepEqual(result, { ok: true });
  });

  it("allows closing when away has at least one active player", () => {
    const result = validateMatchCloseRoster({
      homeActiveCount: 0,
      awayActiveCount: 2,
      targetStatus: "finished",
    });

    assert.deepEqual(result, { ok: true });
  });

  it("skips roster validation for non-closing statuses", () => {
    const result = validateMatchCloseRoster({
      homeActiveCount: 0,
      awayActiveCount: 0,
      targetStatus: "scheduled",
    });

    assert.deepEqual(result, { ok: true });
  });
});

describe("humanizeCaptureError roster close", () => {
  it("maps roster RPC error to a friendly Spanish message", () => {
    const parsed = humanizeCaptureError(MATCH_CLOSE_ROSTER_RPC_ERROR);

    assert.equal(parsed.kind, "roster_required");
    assert.equal(parsed.message, MATCH_CLOSE_ROSTER_USER_MESSAGE);
    assert.match(parsed.message, /plantel/i);
  });
});
