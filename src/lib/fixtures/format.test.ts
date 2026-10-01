import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateTimeMx } from "@/lib/fixtures/format";

describe("formatDateTimeMx", () => {
  it("shows a UTC instant in America/Mexico_City", () => {
    const formatted = formatDateTimeMx("2026-09-30T23:07:46Z").replace(
      /[\u202f\u00a0]/g,
      " "
    );

    assert.equal(formatted, "30 sep 2026, 5:07 p.m.");
  });
});
