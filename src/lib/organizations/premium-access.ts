import { createClient } from "@/lib/supabase/server";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Single entry point for Premium access checks in application code.
 * Do not compare organizations.plan_tier directly elsewhere.
 */
export async function tieneAccesoPremium(
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "organization_has_premium",
    { p_organization_id: organizationId }
  );
  if (error) return false;
  return data === true;
}
