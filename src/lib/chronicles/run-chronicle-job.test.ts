import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { callAI } from "@/lib/ai/call-ai";
import { parseChronicleResponse } from "@/lib/chronicles/parse-chronicle-response";
import { runChronicleJob } from "@/lib/chronicles/run-chronicle-job";

describe("parseChronicleResponse", () => {
  it("parses bare JSON", () => {
    assert.equal(
      parseChronicleResponse('{"cronica":"Gol decisivo al final."}'),
      "Gol decisivo al final."
    );
  });

  it("extracts JSON surrounded by extra text", () => {
    assert.equal(
      parseChronicleResponse(
        'Aquí va:\n{"cronica":"Partido intenso de principio a fin."}\nFin.'
      ),
      "Partido intenso de principio a fin."
    );
  });

  it("throws when JSON lacks cronica", () => {
    assert.throws(
      () => parseChronicleResponse('{"texto":"sin clave cronica"}'),
      /JSON válido con la clave «cronica»/
    );
  });
});

describe("callAI", () => {
  it("returns network errors without throwing", async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    globalThis.fetch = mock.fn(async () => {
      throw new Error("fetch failed");
    }) as typeof fetch;

    try {
      const result = await callAI("system", "user");
      assert.equal(result.text, null);
      assert.match(result.error ?? "", /fetch failed/);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });
});

type MockRow = Record<string, unknown>;

function createMockSupabase() {
  const aiJobs = new Map<string, MockRow>();
  const chronicles = new Map<string, MockRow>();

  const from = (table: string) => {
    const filters: Array<(row: MockRow) => boolean> = [];
    let upsertPayload: MockRow | null = null;
    let updatePayload: MockRow | null = null;

    const chain = {
      update(payload: MockRow) {
        updatePayload = payload;
        return chain;
      },
      upsert(payload: MockRow) {
        upsertPayload = payload;
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return chain;
      },
      async then(
        resolve: (value: { error: null | { message: string } }) => void,
        reject?: (reason: unknown) => void
      ) {
        try {
          if (table === "ai_jobs" && updatePayload) {
            const row = [...aiJobs.values()].find((candidate) =>
              filters.every((filter) => filter(candidate))
            );
            if (row) {
              Object.assign(row, updatePayload);
            }
            resolve({ error: null });
            return;
          }

          if (table === "match_chronicles" && upsertPayload) {
            const matchId = upsertPayload.match_id as string;
            chronicles.set(matchId, { ...upsertPayload });
            resolve({ error: null });
            return;
          }

          resolve({ error: null });
        } catch (error) {
          reject?.(error);
        }
      },
    };

    return chain;
  };

  return {
    from,
    seedJob(id: string, row: MockRow) {
      aiJobs.set(id, { id, ...row });
    },
    getJob(id: string) {
      return aiJobs.get(id) ?? null;
    },
    getChronicle(matchId: string) {
      return chronicles.get(matchId) ?? null;
    },
  };
}

describe("runChronicleJob", () => {
  it("marks job done and upserts match_chronicles on valid AI response", async () => {
    const mock = createMockSupabase();
    mock.seedJob("job-1", {
      organization_id: "org-1",
      status: "pending",
    });

    const result = await runChronicleJob(
      mock as unknown as Parameters<typeof runChronicleJob>[0],
      {
        jobId: "job-1",
        organizationId: "org-1",
        matchId: "match-1",
        prompt: "prompt",
      },
      async () => '{"cronica":"Gran remontada en el segundo tiempo."}'
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.content, "Gran remontada en el segundo tiempo.");
    }

    const job = mock.getJob("job-1");
    assert.equal(job?.status, "done");
    assert.deepEqual(job?.resultado, {
      cronica: "Gran remontada en el segundo tiempo.",
    });
    assert.equal(job?.error_message, null);
    assert.ok(job?.processed_at);

    const chronicle = mock.getChronicle("match-1");
    assert.equal(chronicle?.content, "Gran remontada en el segundo tiempo.");
    assert.equal(chronicle?.tier, "basico");
    assert.equal(chronicle?.is_published, false);
    assert.equal(chronicle?.ai_job_id, "job-1");
  });

  it("marks job error when AI response is not parseable JSON", async () => {
    const mock = createMockSupabase();
    mock.seedJob("job-2", {
      organization_id: "org-1",
      status: "pending",
    });

    const result = await runChronicleJob(
      mock as unknown as Parameters<typeof runChronicleJob>[0],
      {
        jobId: "job-2",
        organizationId: "org-1",
        matchId: "match-2",
        prompt: "prompt",
      },
      async () => "respuesta libre sin json"
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errorMessage, /JSON válido/);
    }

    const job = mock.getJob("job-2");
    assert.equal(job?.status, "error");
    assert.match(String(job?.error_message), /JSON válido/);
    assert.equal(mock.getChronicle("match-2"), null);
  });

  it("marks job error when generation fails", async () => {
    const mock = createMockSupabase();
    mock.seedJob("job-3", {
      organization_id: "org-1",
      status: "pending",
    });

    const result = await runChronicleJob(
      mock as unknown as Parameters<typeof runChronicleJob>[0],
      {
        jobId: "job-3",
        organizationId: "org-1",
        matchId: "match-3",
        prompt: "prompt",
      },
      async () => {
        throw new Error("Anthropic API 503: service unavailable");
      }
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errorMessage, /503/);
    }

    const job = mock.getJob("job-3");
    assert.equal(job?.status, "error");
    assert.match(String(job?.error_message), /503/);
    assert.equal(mock.getChronicle("match-3"), null);
  });
});
