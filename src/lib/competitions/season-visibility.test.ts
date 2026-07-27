import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManageActiveSeason,
  isSeasonArchived,
  pickLatestActiveSeason,
  splitSeasonsByArchive,
} from "@/lib/competitions/season-visibility";

describe("isSeasonArchived", () => {
  it("returns true only for archived", () => {
    assert.equal(isSeasonArchived("archived"), true);
    assert.equal(isSeasonArchived("public"), false);
  });
});

describe("splitSeasonsByArchive", () => {
  it("separates archived from active", () => {
    const { active, archived } = splitSeasonsByArchive([
      { visibility: "public", id: "1" },
      { visibility: "archived", id: "2" },
    ]);
    assert.equal(active.length, 1);
    assert.equal(archived.length, 1);
    assert.equal(active[0].id, "1");
  });
});

describe("pickLatestActiveSeason", () => {
  it("skips archived seasons", () => {
    const picked = pickLatestActiveSeason([
      { visibility: "archived", id: "a" },
      { visibility: "private", id: "b" },
    ]);
    assert.equal(picked?.id, "b");
  });
});

describe("canManageActiveSeason", () => {
  it("denies manage on archived even for admin flag", () => {
    assert.equal(
      canManageActiveSeason({ visibility: "archived" }, true),
      false
    );
    assert.equal(canManageActiveSeason({ visibility: "public" }, true), true);
  });
});
