import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { SeasonArchivedBanner } from "@/components/competitions/SeasonArchivedBanner";
import { isSeasonArchived } from "@/lib/competitions/season-visibility";

type SeasonLayoutProps = {
  children: ReactNode;
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonLayout({
  children,
  params,
}: SeasonLayoutProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

  return (
    <div className="space-y-6">
      {isSeasonArchived(season.visibility) && <SeasonArchivedBanner />}
      {children}
    </div>
  );
}
