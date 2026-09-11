import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseInitialSeasonSetup } from "./initial-season-setup.ts";

describe("parseInitialSeasonSetup", () => {
  it("parses format and match duration with defaults", () => {
    const formData = new FormData();
    formData.set("formatType", "round_robin_double");
    formData.set("matchDurationMinutes", "70");

    const result = parseInitialSeasonSetup(formData);
    assert.equal(Object.keys(result.fieldErrors).length, 0);
    assert.equal(result.parsed?.formatType, "round_robin_double");
    assert.equal(result.parsed?.matchDurationMinutes, 70);
    assert.equal(result.parsed?.pointsWin, 3);
  });

  it("requires groups advance for groups_knockout", () => {
    const formData = new FormData();
    formData.set("formatType", "groups_knockout");
    formData.set("matchDurationMinutes", "90");

    const result = parseInitialSeasonSetup(formData);
    assert.ok(result.fieldErrors.groupsAdvancePerGroup);
    assert.equal(result.parsed, null);
  });
});
