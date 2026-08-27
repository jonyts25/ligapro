import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Documents the enqueueChronicleAction guard ordering: tier check runs before
 * ai_jobs insert (see src/lib/chronicles/actions.ts).
 */
describe("enqueueChronicleAction tier guard ordering", () => {
  it("checks chronicle quota before inserting ai_jobs", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../chronicles/actions.ts", import.meta.url),
        "utf8"
      )
    );

    const tierCheckIndex = source.indexOf("assertCanGenerateChronicle");
    const insertIndex = source.indexOf('.from("ai_jobs")');

    assert.ok(tierCheckIndex > 0, "tier check import/call must exist");
    assert.ok(insertIndex > tierCheckIndex, "ai_jobs insert must happen after tier check");
    assert.match(
      source.slice(tierCheckIndex, insertIndex),
      /if \(!tierCheck\.ok\)/
    );
  });
});
