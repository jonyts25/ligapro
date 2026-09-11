import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSeasonFormatLocked,
  isSeasonMatchDurationLocked,
} from "./season-edit-guards.ts";

describe("isSeasonFormatLocked", () => {
  it("locks when fixture is generated", () => {
    assert.equal(
      isSeasonFormatLocked({
        readiness: {
          fixtureGenerated: true,
          scheduledMatches: 0,
        } as never,
      }),
      true
    );
  });

  it("locks when matches are scheduled", () => {
    assert.equal(
      isSeasonFormatLocked({
        readiness: {
          fixtureGenerated: false,
          scheduledMatches: 2,
        } as never,
      }),
      true
    );
  });

  it("allows edits before fixture and scheduling", () => {
    assert.equal(
      isSeasonFormatLocked({
        readiness: {
          fixtureGenerated: false,
          scheduledMatches: 0,
        } as never,
      }),
      false
    );
  });
});

describe("isSeasonMatchDurationLocked", () => {
  it("follows the same lock rules as format", () => {
    const locked = {
      readiness: {
        fixtureGenerated: true,
        scheduledMatches: 1,
      } as never,
    };
    assert.equal(isSeasonMatchDurationLocked(locked), true);
  });
});
