import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  duplicateConfirmationMessage,
  normalizePlayerPhoneForSearch,
  shouldPromptDuplicateConfirmation,
  type PotentialDuplicatePlayer,
} from "@/lib/teams/player-duplicate-ui";

const sampleDuplicate: PotentialDuplicatePlayer = {
  playerId: "player-1",
  fullName: "Juan Pérez",
  isClaimed: false,
  teamsCount: 2,
};

describe("player duplicate UI helpers", () => {
  it("normalizePlayerPhoneForSearch returns null for blank phone", () => {
    assert.equal(normalizePlayerPhoneForSearch(""), null);
    assert.equal(normalizePlayerPhoneForSearch("   "), null);
  });

  it("shouldPromptDuplicateConfirmation is false without phone or matches", () => {
    assert.equal(shouldPromptDuplicateConfirmation("", [sampleDuplicate]), false);
    assert.equal(shouldPromptDuplicateConfirmation("5551234567", []), false);
  });

  it("shouldPromptDuplicateConfirmation is true when phone and duplicates exist", () => {
    assert.equal(
      shouldPromptDuplicateConfirmation("5551234567", [sampleDuplicate]),
      true
    );
  });

  it("duplicateConfirmationMessage includes name, teams count, and claim state", () => {
    assert.match(
      duplicateConfirmationMessage(sampleDuplicate),
      /Juan Pérez/
    );
    assert.match(
      duplicateConfirmationMessage(sampleDuplicate),
      /2 equipos/
    );
    assert.match(
      duplicateConfirmationMessage({
        ...sampleDuplicate,
        isClaimed: true,
        teamsCount: 1,
      }),
      /Perfil ya reclamado/
    );
  });
});
