import { createClient } from "@/lib/supabase/server";
import {
  buildTierLimitStatus,
  getEffectiveLimits,
  normalizeSubscriptionTier,
  parseAddonOverrides,
} from "@/lib/billing/tier-limits";
import type {
  AddonOverrides,
  OrganizationUsage,
  SubscriptionTier,
  TierLimits,
} from "@/lib/billing/tier-limits";

export type PlatformOrganizationSubscriptionRow = {
  organizationId: string;
  organizationName: string;
  subscriptionTier: SubscriptionTier;
  addonOverrides: AddonOverrides;
  usage: OrganizationUsage;
  limits: TierLimits;
};

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type SubscriptionLimitsRpcRow = {
  organization_id: string;
  organization_name: string;
  subscription_tier: string;
  addon_overrides: unknown;
  active_competitions: number | string;
  active_venues: number | string;
  active_fields: number | string;
  staff_users: number | string;
  chronicles_this_month: number | string;
};

export async function getPlatformOrganizationsSubscriptionLimits(): Promise<
  PlatformOrganizationSubscriptionRow[]
> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "get_platform_organizations_subscription_limits"
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SubscriptionLimitsRpcRow[];

  return rows.map((row) => {
    const subscription = {
      subscriptionTier: normalizeSubscriptionTier(row.subscription_tier),
      addonOverrides: parseAddonOverrides(row.addon_overrides),
    };
    const usage = {
      torneos_activos: Number(row.active_competitions),
      sedes: Number(row.active_venues),
      canchas_total: Number(row.active_fields),
      usuarios_staff: Number(row.staff_users),
      cronicas_mes: Number(row.chronicles_this_month),
    };
    const status = buildTierLimitStatus(subscription, usage);

    return {
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      subscriptionTier: status.subscription.subscriptionTier,
      addonOverrides: status.subscription.addonOverrides,
      usage: status.usage,
      limits: status.limits,
    };
  });
}
