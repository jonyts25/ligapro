import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getCompetitionWithSeasons } from "@/lib/competitions/queries";
import { pickLatestActiveSeason } from "@/lib/competitions/season-visibility";

type PageProps = {
  params: Promise<{ organizationId: string; competitionId: string }>;
};

export default async function CompetitionDetailPage({ params }: PageProps) {
  const { organizationId, competitionId } = await params;
  await requireUser();

  const competition = await getCompetitionWithSeasons(
    organizationId,
    competitionId
  );
  if (!competition) notFound();

  // TODO(ligapro-dev): torneos con más de una season activa requieren revisión manual
  // antes de retirar por completo el selector de temporadas en la UI.
  if (competition.seasons.length > 1) {
    console.warn(
      `[ligapro] competition ${competitionId} has ${competition.seasons.length} seasons — review manually`
    );
  }

  const primarySeason =
    pickLatestActiveSeason(competition.seasons) ?? competition.seasons[0];

  if (primarySeason) {
    redirect(
      `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${primarySeason.id}`
    );
  }

  redirect(`/organizaciones/${organizationId}/torneos`);
}
