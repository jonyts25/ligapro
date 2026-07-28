export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { getPlatformFinanceSummary } from "@/lib/platform-finance/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";
import { PlatformFinancePanel } from "@/components/platform-finance/PlatformFinancePanel";

type PageProps = {
  searchParams: Promise<{ anio?: string; mes?: string }>;
};

function resolveYearMonth(searchParams: { anio?: string; mes?: string }) {
  const now = new Date();
  const year = Number.parseInt(searchParams.anio ?? "", 10);
  const month = Number.parseInt(searchParams.mes ?? "", 10);

  return {
    year: Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear(),
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };
}

export default async function PlatformFinancePage({ searchParams }: PageProps) {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const params = await searchParams;
  const { year, month } = resolveYearMonth(params);
  const summary = await getPlatformFinanceSummary(year, month);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Finanzas internas"
        description="Registro manual de ingresos y egresos de plataforma — control interno, no contabilidad fiscal."
      />
      <PlatformPlataformaNav />
      <PlatformFinancePanel summary={summary} />
    </div>
  );
}
