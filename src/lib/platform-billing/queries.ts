import { createClient } from "@/lib/supabase/server";
import type { PlatformBillingRow } from "@/lib/platform-billing/types";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type OverviewRpcRow = {
  season_id: string;
  organization_id: string;
  organization_name: string;
  plan_tier: string;
  season_name: string;
  platform_billing_status: string;
  enrolled_team_count: number;
  has_fixture: boolean;
};

export async function isPlatformStaff(profileId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "is_platform_staff",
    { p_profile_id: profileId }
  );
  if (error) return false;
  return data === true;
}

export async function getPlatformBillingOverview(): Promise<
  PlatformBillingRow[]
> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "get_platform_billing_overview"
  );
  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as OverviewRpcRow[];
  return rows.map((row) => ({
    seasonId: row.season_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    planTier: row.plan_tier === "premium" ? "premium" : "basico",
    seasonName: row.season_name,
    platformBillingStatus: row.platform_billing_status,
    enrolledTeamCount: Number(row.enrolled_team_count),
    hasFixture: row.has_fixture,
  }));
}

export type { PlatformBillingRow } from "@/lib/platform-billing/types";
