import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  handleDeleteAccount,
  type DeleteAccountDeps,
} from "@/lib/auth/delete-account-handler";

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }
  return new Request("http://localhost/api/internal/account/delete", {
    method: "POST",
    headers,
  });
}

function makeDeps(overrides: Partial<DeleteAccountDeps>): DeleteAccountDeps {
  return {
    getSupabaseConfig: () => ({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    }),
    createAnonClient: () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: { message: "bad" } }),
        },
      }) as unknown as SupabaseClient,
    createUserClient: () =>
      ({
        rpc: async () => ({ data: null, error: null }),
      }) as unknown as SupabaseClient,
    deleteUserWithServiceRole: async () => ({ error: null }),
    ...overrides,
  };
}

describe("delete account handler", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const response = await handleDeleteAccount(makeRequest(), makeDeps({}));

    assert.equal(response.status, 401);
  });

  it("returns 401 when bearer token is invalid", async () => {
    const deps = makeDeps({
      createAnonClient: () =>
        ({
          auth: {
            getUser: async () => ({
              data: { user: null },
              error: { message: "invalid JWT" },
            }),
          },
        }) as unknown as SupabaseClient,
    });

    const response = await handleDeleteAccount(makeRequest("bad-token"), deps);

    assert.equal(response.status, 401);
  });

  it("returns 409 with blocking organization names when can_delete is false", async () => {
    const deps = makeDeps({
      createAnonClient: () =>
        ({
          auth: {
            getUser: async () => ({
              data: { user: { id: "user-1" } },
              error: null,
            }),
          },
        }) as unknown as SupabaseClient,
      createUserClient: () =>
        ({
          rpc: async () => ({
            data: [
              {
                can_delete: false,
                blocking_organization_names: ["Liga Norte", "Copa Sur"],
              },
            ],
            error: null,
          }),
        }) as unknown as SupabaseClient,
    });

    const response = await handleDeleteAccount(makeRequest("valid-token"), deps);
    const body = (await response.json()) as {
      ok: boolean;
      blocking_organization_names: string[];
    };

    assert.equal(response.status, 409);
    assert.equal(body.ok, false);
    assert.deepEqual(body.blocking_organization_names, ["Liga Norte", "Copa Sur"]);
  });

  it("returns 200 and deletes the user when can_delete is true", async () => {
    let deletedUserId: string | null = null;

    const deps = makeDeps({
      createAnonClient: () =>
        ({
          auth: {
            getUser: async () => ({
              data: { user: { id: "user-42" } },
              error: null,
            }),
          },
        }) as unknown as SupabaseClient,
      createUserClient: () =>
        ({
          rpc: async () => ({
            data: [{ can_delete: true, blocking_organization_names: [] }],
            error: null,
          }),
        }) as unknown as SupabaseClient,
      deleteUserWithServiceRole: async (userId) => {
        deletedUserId = userId;
        return { error: null };
      },
    });

    const response = await handleDeleteAccount(makeRequest("valid-token"), deps);
    const body = (await response.json()) as { ok: boolean };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(deletedUserId, "user-42");
  });
});
