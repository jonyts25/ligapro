import { createClient } from "@/lib/supabase/server";
import type {
  PlatformExpenseCategory,
  PlatformFinanceSummary,
} from "@/lib/platform-finance/types";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type SummaryRpc = {
  year: number;
  month: number;
  total_income: number;
  total_expenses: number;
  net: number;
  income_entries: Array<{
    id: string;
    season_id: string | null;
    organization_id: string | null;
    organization_name: string | null;
    season_name: string | null;
    amount: number;
    recorded_at: string;
    notes: string | null;
    voided_at: string | null;
    void_reason: string | null;
  }>;
  expense_entries: Array<{
    id: string;
    category: PlatformExpenseCategory;
    amount: number;
    recorded_at: string;
    notes: string | null;
    voided_at: string | null;
    void_reason: string | null;
  }>;
};

export async function getPlatformFinanceSummary(
  year: number,
  month: number
): Promise<PlatformFinanceSummary> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "get_platform_finance_summary",
    { p_year: year, p_month: month }
  );

  if (error) {
    throw new Error(error.message);
  }

  const summary = data as SummaryRpc;

  return {
    year: summary.year,
    month: summary.month,
    totalIncome: Number(summary.total_income),
    totalExpenses: Number(summary.total_expenses),
    net: Number(summary.net),
    incomeEntries: (summary.income_entries ?? []).map((row) => ({
      id: row.id,
      seasonId: row.season_id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      seasonName: row.season_name,
      amount: Number(row.amount),
      recordedAt: row.recorded_at,
      notes: row.notes,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
    })),
    expenseEntries: (summary.expense_entries ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      amount: Number(row.amount),
      recordedAt: row.recorded_at,
      notes: row.notes,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
    })),
  };
}
