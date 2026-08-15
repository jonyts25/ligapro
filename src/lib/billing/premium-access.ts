import { createClient } from "@/lib/supabase/server";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Punto único de verificación Premium (ADR-0017).
 * Todo el código debe usar esta función — nunca comparar plan_tier directamente.
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

export type OrganizationPlanTier = "basico" | "premium";

export async function getOrganizationPlanTier(
  organizationId: string
): Promise<OrganizationPlanTier> {
  const premium = await tieneAccesoPremium(organizationId);
  return premium ? "premium" : "basico";
}
