import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getSeasonDetails } from "@/lib/competitions/queries";
import { isSeasonArchived } from "@/lib/competitions/season-visibility";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeasonForm } from "@/components/competitions/SeasonForm";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function EditSeasonPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();
  if (isSeasonArchived(season.visibility)) {
    redirect(
      `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Editar temporada"
        description={season.name}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <SeasonForm
        organizationId={organizationId}
        competitionId={competitionId}
        mode="edit"
        season={season}
      />
    </div>
  );
}
