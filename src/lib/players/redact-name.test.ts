import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactPlayerNameForPublic } from "@/lib/players/redact-name";

describe("redactPlayerNameForPublic", () => {
  it("returns first name and surname initial for typical full names", () => {
    assert.equal(redactPlayerNameForPublic("Juan Pérez García"), "Juan P.");
    assert.equal(redactPlayerNameForPublic("María José López"), "María J.");
  });

  it("returns only the first token when there is no surname", () => {
    assert.equal(redactPlayerNameForPublic("Pelé"), "Pelé");
  });

  it("trims whitespace and collapses internal spaces", () => {
    assert.equal(redactPlayerNameForPublic("  Ana   Torres  "), "Ana T.");
  });

  it("returns empty string for empty input", () => {
    assert.equal(redactPlayerNameForPublic(""), "");
    assert.equal(redactPlayerNameForPublic("   "), "");
  });
});
