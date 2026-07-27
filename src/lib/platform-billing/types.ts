export type PlatformBillingRow = {
  seasonId: string;
  organizationName: string;
  seasonName: string;
  platformBillingStatus: string;
  enrolledTeamCount: number;
  hasFixture: boolean;
};

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
