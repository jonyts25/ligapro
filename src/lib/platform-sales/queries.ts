import { createClient } from "@/lib/supabase/server";
import type { PlatformSalesRow } from "@/lib/platform-sales/types";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type SalesOverviewRpcRow = {
  organization_id: string;
  organization_name: string;
  sold_by_staff_id: string | null;
  sold_by_display_name: string | null;
  active_season_count: number;
  member_count: number;
  organization_created_at: string;
};

export async function getPlatformSalesOverview(): Promise<PlatformSalesRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "get_platform_sales_overview"
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SalesOverviewRpcRow[];
  return rows.map((row) => ({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    soldByStaffId: row.sold_by_staff_id,
    soldByDisplayName: row.sold_by_display_name,
    activeSeasonCount: Number(row.active_season_count),
    memberCount: Number(row.member_count),
    organizationCreatedAt: row.organization_created_at,
  }));
}

export type { PlatformSalesRow } from "@/lib/platform-sales/types";
