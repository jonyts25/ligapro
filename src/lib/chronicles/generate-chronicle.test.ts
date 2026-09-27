import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateChronicleForMatch } from "@/lib/chronicles/generate-chronicle";

type QueryResult<T> = Promise<{ data: T; error: null }>;

function createApprovalGateSupabase(approvedAt: string | null) {
  return {
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        maybeSingle(): QueryResult<{ result_approved_at: string | null } | null> {
          if (table === "matches") {
            return Promise.resolve({
              data: { result_approved_at: approvedAt },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
  };
}

describe("generateChronicleForMatch", () => {
  it("blocks generation when result is not official", async () => {
    const result = await generateChronicleForMatch({
      supabase: createApprovalGateSupabase(null) as never,
      organizationId: "org-1",
      competitionId: "comp-1",
      seasonId: "season-1",
      matchId: "match-1",
      actorProfileId: "user-1",
      confirmRegenerate: false,
    });

    assert.equal(result.ok, false);
    assert.equal(result.message, "El resultado todavía no es oficial.");
  });

  it("returns ok when a chronicle job is already in progress", async () => {
    const supabase = {
      from(table: string) {
        const chain = {
          select() {
            return chain;
          },
          eq() {
            return chain;
          },
          in() {
            return chain;
          },
          order() {
            return chain;
          },
          limit() {
            if (table === "ai_jobs") {
              return Promise.resolve({
                data: [
                  {
                    id: "job-1",
                    status: "processing",
                    error_message: null,
                    created_at: "2026-01-01T00:00:00Z",
                    processed_at: null,
                    payload: { match_id: "match-1" },
                  },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          },
          maybeSingle(): QueryResult<{ result_approved_at: string | null } | null> {
            if (table === "matches") {
              return Promise.resolve({
                data: { result_approved_at: "2026-01-02T00:00:00Z" },
                error: null,
              });
            }
            if (table === "match_chronicles") {
              return Promise.resolve({ data: null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
        return chain;
      },
    };

    const result = await generateChronicleForMatch({
      supabase: supabase as never,
      organizationId: "org-1",
      competitionId: "comp-1",
      seasonId: "season-1",
      matchId: "match-1",
      actorProfileId: null,
      confirmRegenerate: false,
    });

    assert.equal(result.ok, true);
    assert.equal(result.message, "Ya en proceso");
  });
});
