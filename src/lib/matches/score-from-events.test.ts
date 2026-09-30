import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveScoreManualSave,
  SCORE_MISMATCH_CONFIRM_MESSAGE,
} from "@/lib/matches/score-from-events";

const events3to2 = {
  eventHome: 3,
  eventAway: 2,
  scoringEventCount: 5,
};

describe("resolveScoreManualSave", () => {
  it("keeps override false when the saved score matches captured goals", () => {
    const result = resolveScoreManualSave({
      submittedHome: 3,
      submittedAway: 2,
      ...events3to2,
      recalculateFromEvents: false,
      confirmMismatch: false,
    });
    assert.deepEqual(result, {
      ok: true,
      homeScore: 3,
      awayScore: 2,
      scoreManualOverride: false,
    });
  });

  it("requires confirmation and then sets override when the numbers differ", () => {
    const rejected = resolveScoreManualSave({
      submittedHome: 4,
      submittedAway: 2,
      ...events3to2,
      recalculateFromEvents: false,
      confirmMismatch: false,
    });
    assert.deepEqual(rejected, {
      ok: false,
      message: SCORE_MISMATCH_CONFIRM_MESSAGE,
    });

    const saved = resolveScoreManualSave({
      submittedHome: 4,
      submittedAway: 2,
      ...events3to2,
      recalculateFromEvents: false,
      confirmMismatch: true,
    });
    assert.deepEqual(saved, {
      ok: true,
      homeScore: 4,
      awayScore: 2,
      scoreManualOverride: true,
    });
  });

  it("recalculate clears the override and restores the event score", () => {
    const result = resolveScoreManualSave({
      submittedHome: 9,
      submittedAway: 9,
      ...events3to2,
      recalculateFromEvents: true,
      confirmMismatch: false,
    });
    assert.deepEqual(result, {
      ok: true,
      homeScore: 3,
      awayScore: 2,
      scoreManualOverride: false,
    });
  });

  it("lets a walkover without goal events keep a manual score", () => {
    const result = resolveScoreManualSave({
      submittedHome: 3,
      submittedAway: 0,
      eventHome: 0,
      eventAway: 0,
      scoringEventCount: 0,
      recalculateFromEvents: false,
      confirmMismatch: false,
    });
    assert.deepEqual(result, {
      ok: true,
      homeScore: 3,
      awayScore: 0,
      scoreManualOverride: true,
    });
  });
});
