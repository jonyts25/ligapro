export type PlatformBillingRow = {
  seasonId: string;
  organizationId: string;
  organizationName: string;
  planTier: "basico" | "premium";
  seasonName: string;
  platformBillingStatus: string;
  enrolledTeamCount: number;
  hasFixture: boolean;
};

export const PLAN_TIER_OPTIONS = [
  { value: "basico", label: "Básico" },
  { value: "premium", label: "Premium" },
] as const;

export type PlanTier = (typeof PLAN_TIER_OPTIONS)[number]["value"];

export function planTierLabel(tier: string): string {
  return PLAN_TIER_OPTIONS.find((t) => t.value === tier)?.label ?? tier;
}

export const PLATFORM_BILLING_STATUSES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "pagado", label: "Pagado" },
  { value: "vencido", label: "Vencido" },
] as const;

export type PlatformBillingStatus =
  (typeof PLATFORM_BILLING_STATUSES)[number]["value"];

export function billingStatusLabel(status: string): string {
  return (
    PLATFORM_BILLING_STATUSES.find((s) => s.value === status)?.label ?? status
  );
}
