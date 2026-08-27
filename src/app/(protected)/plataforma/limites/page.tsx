export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { getPlatformOrganizationsSubscriptionLimits } from "@/lib/billing/platform-subscription-queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";
import { PlatformSubscriptionLimitsPanel } from "@/components/billing/PlatformSubscriptionLimitsPanel";
import { PLATFORM_NAME } from "@/lib/platform/config";

export default async function PlatformSubscriptionLimitsPage() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const rows = await getPlatformOrganizationsSubscriptionLimits();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Límites operativos"
        description={`Panel interno ${PLATFORM_NAME} — tiers, uso y addons manuales por organización.`}
      />
      <PlatformPlataformaNav />
      <PlatformSubscriptionLimitsPanel rows={rows} />
    </div>
  );
}
