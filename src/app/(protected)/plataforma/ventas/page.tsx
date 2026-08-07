export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { getPlatformSalesOverview } from "@/lib/platform-sales/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";
import { PlatformSalesPanel } from "@/components/platform-billing/PlatformSalesPanel";
import { PLATFORM_NAME } from "@/lib/platform/config";

export default async function PlatformSalesPage() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const rows = await getPlatformSalesOverview();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Ventas de plataforma"
        description={`Panel interno ${PLATFORM_NAME} — organizaciones atribuidas por vendedor.`}
      />
      <PlatformPlataformaNav />
      <PlatformSalesPanel rows={rows} />
    </div>
  );
}
