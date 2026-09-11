import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getCompetitionWithSeasons } from "@/lib/competitions/queries";
import { pickLatestActiveSeason } from "@/lib/competitions/season-visibility";

type PageProps = {
  params: Promise<{ organizationId: string; competitionId: string }>;
};

export default async function NewSeasonPage({ params }: PageProps) {
  const { organizationId, competitionId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const competition = await getCompetitionWithSeasons(
    organizationId,
    competitionId
  );
  if (!competition) notFound();

  const primarySeason =
    pickLatestActiveSeason(competition.seasons) ?? competition.seasons[0];

  if (primarySeason) {
    redirect(
      `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${primarySeason.id}`
    );
  }

  redirect(`/organizaciones/${organizationId}/torneos/nuevo`);
}
