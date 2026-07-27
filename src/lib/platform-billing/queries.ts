import { createClient } from "@/lib/supabase/server";
import type { PlatformBillingRow } from "@/lib/platform-billing/types";
import {
  DEFAULT_COTIZADOR_PARAMS,
  type CotizadorParams,
} from "@/lib/platform-billing/cotizador";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type OverviewRpcRow = {
  season_id: string;
  organization_name: string;
  season_name: string;
  platform_billing_status: string;
  enrolled_team_count: number;
  has_fixture: boolean;
};

type PricingDefaultsRpcRow = {
  base_price_per_team: number;
  duration_multiplier_hasta_3: number;
  duration_multiplier_4_to_6: number;
  duration_multiplier_7_to_12: number;
  volume_multiplier_1_to_2: number;
  volume_multiplier_3_to_5: number;
  volume_multiplier_6_plus: number;
  updated_at: string | null;
  updated_by_profile_id: string | null;
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
    organizationName: row.organization_name,
    seasonName: row.season_name,
    platformBillingStatus: row.platform_billing_status,
    enrolledTeamCount: Number(row.enrolled_team_count),
    hasFixture: row.has_fixture,
  }));
}

export async function getPlatformPricingDefaults(): Promise<CotizadorParams> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "get_platform_pricing_defaults"
  );
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PricingDefaultsRpcRow[];
  const row = rows[0];
  if (!row) {
    return DEFAULT_COTIZADOR_PARAMS;
  }

  return {
    basePricePerTeam: Number(row.base_price_per_team),
    durationMultiplierHasta3: Number(row.duration_multiplier_hasta_3),
    durationMultiplier4To6: Number(row.duration_multiplier_4_to_6),
    durationMultiplier7To12: Number(row.duration_multiplier_7_to_12),
    volumeMultiplier1To2: Number(row.volume_multiplier_1_to_2),
    volumeMultiplier3To5: Number(row.volume_multiplier_3_to_5),
    volumeMultiplier6Plus: Number(row.volume_multiplier_6_plus),
  };
}

export type { PlatformBillingRow } from "@/lib/platform-billing/types";
