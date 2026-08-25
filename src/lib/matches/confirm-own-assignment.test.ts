import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canConfirmOwnAssignment } from "@/lib/matches/confirm-own-assignment";

describe("canConfirmOwnAssignment", () => {
  it("allows self-confirm only while status is assigned", () => {
    assert.equal(canConfirmOwnAssignment("assigned"), true);
    assert.equal(canConfirmOwnAssignment("confirmed"), false);
    assert.equal(canConfirmOwnAssignment("declined"), false);
  });
});
