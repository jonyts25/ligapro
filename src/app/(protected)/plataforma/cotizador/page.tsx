export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPlatformPricingDefaults,
  isPlatformStaff,
} from "@/lib/platform-billing/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformCotizadorPanel } from "@/components/platform-billing/PlatformCotizadorPanel";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";
import { PLATFORM_NAME } from "@/lib/platform/config";

export default async function PlatformCotizadorPage() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const initialParams = await getPlatformPricingDefaults();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Cotizador interno"
        description={`Calculadora hipotética de precio por torneo — ${PLATFORM_NAME} staff. Los parámetros de precio se guardan para todo el equipo; las líneas de cotización no.`}
      />
      <PlatformPlataformaNav />
      <PlatformCotizadorPanel initialParams={initialParams} />
    </div>
  );
}
