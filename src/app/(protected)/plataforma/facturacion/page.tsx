export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPlatformBillingOverview,
  isPlatformStaff,
} from "@/lib/platform-billing/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformBillingPanel } from "@/components/platform-billing/PlatformBillingPanel";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";

type PageProps = {
  searchParams: Promise<{ estado?: string }>;
};

export default async function PlatformBillingPage({ searchParams }: PageProps) {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const { estado } = await searchParams;
  const rows = await getPlatformBillingOverview();

  const allowed = ["all", "pendiente", "pagado", "vencido"];
  const filter = allowed.includes(estado ?? "") ? (estado ?? "all") : "all";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Facturación de plataforma"
        description="Panel interno LigaPro — estados de facturación por temporada."
      />
      <PlatformPlataformaNav />
      <PlatformBillingPanel rows={rows} initialFilter={filter} />
    </div>
  );
}
