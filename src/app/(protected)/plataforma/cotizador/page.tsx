export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformCotizadorPanel } from "@/components/platform-billing/PlatformCotizadorPanel";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";

export default async function PlatformCotizadorPage() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Cotizador interno"
        description="Calculadora hipotética de precio por torneo — LigaPro staff. Los valores no se guardan."
      />
      <PlatformPlataformaNav />
      <PlatformCotizadorPanel />
    </div>
  );
}
