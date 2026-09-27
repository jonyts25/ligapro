export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { getTournamentTypePresets } from "@/lib/competitions/modality-presets-queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";
import { PlatformModalityPresetsPanel } from "@/components/competitions/PlatformModalityPresetsPanel";
import { PLATFORM_NAME } from "@/lib/platform/config";

export default async function PlatformModalityPresetsPage() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const presets = await getTournamentTypePresets();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Modalidades de torneo"
        description={`Plantillas globales de reglas — ${PLATFORM_NAME} staff.`}
      />
      <PlatformPlataformaNav />
      <PlatformModalityPresetsPanel presets={presets} />
    </div>
  );
}
