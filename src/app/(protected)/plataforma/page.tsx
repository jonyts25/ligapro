export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import { getRecentlyPublishedSeasons } from "@/lib/platform/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformPlataformaNav } from "@/components/platform-billing/PlatformPlataformaNav";
import { PlatformRecentPublishedSeasons } from "@/components/platform-billing/PlatformRecentPublishedSeasons";
import { PLATFORM_NAME } from "@/lib/platform/config";

export default async function PlatformHomePage() {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    notFound();
  }

  const seasons = await getRecentlyPublishedSeasons(15);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={`Panel ${PLATFORM_NAME}`}
        description="Herramientas internas del staff de plataforma."
      />
      <PlatformPlataformaNav />
      <PlatformRecentPublishedSeasons seasons={seasons} />
    </div>
  );
}
