import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type CanDeleteAccountRow = {
  can_delete: boolean;
  blocking_organization_names: string[] | null;
};

export type DeleteAccountDeps = {
  getSupabaseConfig: () => { url: string; anonKey: string } | null;
  createAnonClient: (
    url: string,
    anonKey: string
  ) => SupabaseClient<Database>;
  createUserClient: (
    url: string,
    anonKey: string,
    accessToken: string
  ) => SupabaseClient<Database>;
  deleteUserWithServiceRole: (userId: string) => Promise<{ error: string | null }>;
};

function parseBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function defaultDeleteAccountDeps(): DeleteAccountDeps {
  return {
    getSupabaseConfig: () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !anonKey) {
        return null;
      }
      return { url, anonKey };
    },
    createAnonClient: (url, anonKey) =>
      createClient<Database>(url, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    createUserClient: (url, anonKey, accessToken) =>
      createClient<Database>(url, anonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    deleteUserWithServiceRole: async (userId) => {
      const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
      const supabase = createServiceRoleClient();
      const { error } = await supabase.auth.admin.deleteUser(userId);
      return { error: error?.message ?? null };
    },
  };
}

export async function handleDeleteAccount(
  request: Request,
  deps: DeleteAccountDeps = defaultDeleteAccountDeps()
): Promise<Response> {
  const token = parseBearerToken(request);
  if (!token) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const config = deps.getSupabaseConfig();
  if (!config) {
    return Response.json(
      { ok: false, message: "Server misconfigured." },
      { status: 500 }
    );
  }

  const anonClient = deps.createAnonClient(config.url, config.anonKey);
  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const userClient = deps.createUserClient(config.url, config.anonKey, token);
  const { data: canDeleteRows, error: rpcError } = await userClient.rpc(
    "can_delete_own_account"
  );

  if (rpcError) {
    return Response.json(
      { ok: false, message: rpcError.message },
      { status: 500 }
    );
  }

  const row = (canDeleteRows?.[0] ?? null) as CanDeleteAccountRow | null;
  const blockingNames = row?.blocking_organization_names ?? [];

  if (!row?.can_delete) {
    return Response.json(
      {
        ok: false,
        message:
          "No puedes eliminar tu cuenta mientras seas el único dueño de una organización.",
        blocking_organization_names: blockingNames,
      },
      { status: 409 }
    );
  }

  const { error: deleteError } = await deps.deleteUserWithServiceRole(user.id);
  if (deleteError) {
    return Response.json({ ok: false, message: deleteError }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
