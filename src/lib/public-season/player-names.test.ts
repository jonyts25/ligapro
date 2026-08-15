import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPublicPlayerName } from "@/lib/public-season/player-names";

describe("mapPublicPlayerName", () => {
  it("redacts names for youth competitions on public routes", () => {
    assert.equal(
      mapPublicPlayerName("Juan Pérez García", true),
      "Juan P."
    );
  });

  it("keeps full names for non-youth competitions", () => {
    assert.equal(
      mapPublicPlayerName("Juan Pérez García", false),
      "Juan Pérez García"
    );
  });
});
