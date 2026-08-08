export type PlatformBillingRow = {
  seasonId: string;
  organizationName: string;
  seasonName: string;
  platformBillingStatus: string;
  enrolledTeamCount: number;
  hasFixture: boolean;
};

export type PlatformOrganizationBillingRow = {
  organizationId: string;
  organizationName: string;
  planTier: "basico" | "premium";
  activeSeasonCount: number;
};

export const PLATFORM_PLAN_TIERS = [
  { value: "basico", label: "Básico" },
  { value: "premium", label: "Premium" },
] as const;

export type PlatformPlanTier =
  (typeof PLATFORM_PLAN_TIERS)[number]["value"];

export function planTierLabel(tier: string): string {
  return (
    PLATFORM_PLAN_TIERS.find((t) => t.value === tier)?.label ?? tier
  );
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
