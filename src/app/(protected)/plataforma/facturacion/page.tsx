export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPlatformBillingOverview,
  getPlatformOrganizationsBilling,
  isPlatformStaff,
} from "@/lib/platform-billing/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformBillingPanel } from "@/components/platform-billing/PlatformBillingPanel";
import { PlatformOrganizationTierPanel } from "@/components/platform-billing/PlatformOrganizationTierPanel";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";
import { PLATFORM_NAME } from "@/lib/platform/config";

type PageProps = {
  searchParams: Promise<{ estado?: string }>;
};

export default async function PlatformBillingPage({ searchParams }: PageProps) {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const { estado } = await searchParams;
  const [rows, orgRows] = await Promise.all([
    getPlatformBillingOverview(),
    getPlatformOrganizationsBilling(),
  ]);

  const allowed = ["all", "pendiente", "pagado", "vencido"];
  const filter = allowed.includes(estado ?? "") ? (estado ?? "all") : "all";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Facturación de plataforma"
        description={`Panel interno ${PLATFORM_NAME} — estados de facturación por temporada.`}
      />
      <PlatformPlataformaNav />
      <PlatformOrganizationTierPanel rows={orgRows} />
      <PlatformBillingPanel rows={rows} initialFilter={filter} />
    </div>
  );
}
