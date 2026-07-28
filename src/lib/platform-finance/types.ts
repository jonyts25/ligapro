export type PlatformExpenseCategory =
  | "hosting"
  | "herramientas"
  | "marketing"
  | "otro";

export type PlatformIncomeEntry = {
  id: string;
  seasonId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  seasonName: string | null;
  amount: number;
  recordedAt: string;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};

export type PlatformExpenseEntry = {
  id: string;
  category: PlatformExpenseCategory;
  amount: number;
  recordedAt: string;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};

export type PlatformFinanceSummary = {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  incomeEntries: PlatformIncomeEntry[];
  expenseEntries: PlatformExpenseEntry[];
};

export const PLATFORM_EXPENSE_CATEGORIES: Array<{
  value: PlatformExpenseCategory;
  label: string;
}> = [
  { value: "hosting", label: "Hosting" },
  { value: "herramientas", label: "Herramientas" },
  { value: "marketing", label: "Marketing" },
  { value: "otro", label: "Otro" },
];

export function expenseCategoryLabel(category: string): string {
  return (
    PLATFORM_EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ??
    category
  );
}

export function formatPlatformMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}
