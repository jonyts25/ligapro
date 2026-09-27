import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Documents generateChronicleForMatch guard ordering: tier check runs before
 * ai_jobs insert (see src/lib/chronicles/generate-chronicle.ts).
 */
describe("generateChronicleForMatch tier guard ordering", () => {
  it("checks chronicle quota before inserting ai_jobs", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../chronicles/generate-chronicle.ts", import.meta.url),
        "utf8"
      )
    );

    const tierCheckIndex = source.indexOf("assertCanGenerateChronicleWithClient");
    const insertIndex = source.indexOf('.from("ai_jobs")');

    assert.ok(tierCheckIndex > 0, "tier check import/call must exist");
    assert.ok(insertIndex > tierCheckIndex, "ai_jobs insert must happen after tier check");
    assert.match(
      source.slice(tierCheckIndex, insertIndex),
      /if \(!tierCheck\.ok\)/
    );
  });
});
