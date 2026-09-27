import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySeasonUpdateLocks,
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

describe("applySeasonUpdateLocks", () => {
  const lockedSeason = {
    format_type: "round_robin" as const,
    readiness: {
      fixtureGenerated: true,
      scheduledMatches: 0,
    },
    rules: {
      match_duration_minutes: 90,
      groups_advance_per_group: 2,
    },
  } as never;

  const parsed = {
    formatType: "groups_knockout" as const,
    matchDurationMinutes: 60,
    groupsAdvancePerGroup: 4,
    name: "Test",
  };

  it("preserves groupsAdvancePerGroup when format is locked", () => {
    const effective = applySeasonUpdateLocks(lockedSeason, parsed);
    assert.equal(effective.groupsAdvancePerGroup, 2);
    assert.equal(effective.formatType, "round_robin");
    assert.equal(effective.matchDurationMinutes, 90);
  });

  it("keeps submitted groupsAdvancePerGroup when format is unlocked", () => {
    const unlockedSeason = {
      ...(lockedSeason as object),
      readiness: { fixtureGenerated: false, scheduledMatches: 0 },
    } as never;
    const effective = applySeasonUpdateLocks(unlockedSeason, parsed);
    assert.equal(effective.groupsAdvancePerGroup, 4);
    assert.equal(effective.formatType, "groups_knockout");
  });
});
