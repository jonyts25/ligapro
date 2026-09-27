import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TIEBREAK_ORDER,
  moveTiebreakItem,
  parseTiebreakOrderInput,
  validateTiebreakOrder,
} from "./tiebreak-order";

describe("validateTiebreakOrder", () => {
  it("accepts the default order", () => {
    const result = validateTiebreakOrder(DEFAULT_TIEBREAK_ORDER);
    assert.equal(result.ok, true);
  });

  it("accepts any permutation of the four criteria", () => {
    const result = validateTiebreakOrder([
      "wins",
      "goals_against",
      "goals_for",
      "goal_difference",
    ]);
    assert.equal(result.ok, true);
  });

  it("rejects incomplete arrays", () => {
    const result = validateTiebreakOrder(["goal_difference", "goals_for"]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /cuatro criterios/);
    }
  });

  it("rejects duplicates", () => {
    const result = validateTiebreakOrder([
      "goal_difference",
      "goal_difference",
      "goals_for",
      "wins",
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /una vez/);
    }
  });

  it("rejects unknown values", () => {
    const result = validateTiebreakOrder([
      "goal_difference",
      "goals_for",
      "goals_against",
      "head_to_head",
    ]);
    assert.equal(result.ok, false);
  });
});

describe("parseTiebreakOrderInput", () => {
  it("parses JSON arrays from the form", () => {
    const result = parseTiebreakOrderInput(
      JSON.stringify(["wins", "goal_difference", "goals_for", "goals_against"])
    );
    assert.equal(result.ok, true);
  });

  it("falls back to default when empty", () => {
    const result = parseTiebreakOrderInput("");
    assert.deepEqual(result.ok ? result.value : null, DEFAULT_TIEBREAK_ORDER);
  });
});

describe("moveTiebreakItem", () => {
  it("moves an item up without mutating the source array", () => {
    const moved = moveTiebreakItem(DEFAULT_TIEBREAK_ORDER, 2, "up");
    assert.deepEqual(moved, [
      "goal_difference",
      "goals_against",
      "goals_for",
      "wins",
    ]);
    assert.notDeepEqual(moved, DEFAULT_TIEBREAK_ORDER);
  });
});
