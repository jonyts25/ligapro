import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDeleteCompetition,
  canDeleteSeason,
  canManageActiveSeason,
  canPublishSeasonVisibility,
  displaySeasonVisibilityLabel,
  isLegacyUnpublishedVisibility,
  isSeasonArchived,
  isSeasonPubliclyVisible,
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

describe("canDeleteSeason", () => {
  it("allows delete only for draft without teams", () => {
    assert.equal(canDeleteSeason({ visibility: "draft", teamCount: 0 }), true);
    assert.equal(canDeleteSeason({ visibility: "draft", teamCount: 1 }), false);
    assert.equal(canDeleteSeason({ visibility: "private", teamCount: 0 }), false);
  });
});

describe("canDeleteCompetition", () => {
  it("allows delete only with zero seasons", () => {
    assert.equal(canDeleteCompetition(0), true);
    assert.equal(canDeleteCompetition(1), false);
  });
});

describe("displaySeasonVisibilityLabel", () => {
  it("shows Borrador for draft and legacy unpublished values", () => {
    assert.equal(displaySeasonVisibilityLabel("draft"), "Borrador");
    assert.equal(displaySeasonVisibilityLabel("private"), "Borrador");
    assert.equal(displaySeasonVisibilityLabel("unlisted"), "Borrador");
    assert.equal(displaySeasonVisibilityLabel("public"), "Pública");
  });
});

describe("canPublishSeasonVisibility", () => {
  it("allows publish from draft and legacy unpublished states", () => {
    assert.equal(canPublishSeasonVisibility("draft"), true);
    assert.equal(canPublishSeasonVisibility("private"), true);
    assert.equal(canPublishSeasonVisibility("unlisted"), true);
    assert.equal(canPublishSeasonVisibility("public"), false);
    assert.equal(canPublishSeasonVisibility("archived"), false);
  });
});

describe("isSeasonPubliclyVisible", () => {
  it("is true only for public visibility", () => {
    assert.equal(isSeasonPubliclyVisible("public"), true);
    assert.equal(isSeasonPubliclyVisible("draft"), false);
    assert.equal(isLegacyUnpublishedVisibility("private"), true);
  });
});
