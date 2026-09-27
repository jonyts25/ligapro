import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { handleAutoGenerateChronicle } from "@/lib/chronicles/auto-generate-handler";

describe("auto-generate chronicle webhook handler", () => {
  const originalSecret = process.env.CHRONICLE_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CHRONICLE_WEBHOOK_SECRET;
    } else {
      process.env.CHRONICLE_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("returns 401 when webhook secret is invalid", async () => {
    process.env.CHRONICLE_WEBHOOK_SECRET = "expected-secret";

    const response = await handleAutoGenerateChronicle(
      new Request("http://localhost/api/internal/chronicles/auto-generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ligera-webhook-secret": "wrong-secret",
        },
        body: JSON.stringify({ match_id: "match-1" }),
      })
    );

    assert.equal(response.status, 401);
  });

  it("returns 401 when webhook secret is not configured", async () => {
    delete process.env.CHRONICLE_WEBHOOK_SECRET;

    const response = await handleAutoGenerateChronicle(
      new Request("http://localhost/api/internal/chronicles/auto-generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ligera-webhook-secret": "any",
        },
        body: JSON.stringify({ match_id: "match-1" }),
      })
    );

    assert.equal(response.status, 401);
  });
});
