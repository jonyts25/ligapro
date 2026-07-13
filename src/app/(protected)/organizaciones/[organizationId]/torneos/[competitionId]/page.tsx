import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getCompetitionWithSeasons } from "@/lib/competitions/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SeasonList } from "@/components/competitions/SeasonList";

type PageProps = {
  params: Promise<{ organizationId: string; competitionId: string }>;
};

export default async function CompetitionDetailPage({ params }: PageProps) {
  const { organizationId, competitionId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const competition = await getCompetitionWithSeasons(
    organizationId,
    competitionId
  );
  if (!competition) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={competition.name}
        description="Temporadas y configuración competitiva."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organizaciones/${organizationId}/torneos`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Todos los torneos
            </Link>
            {canManage && (
              <>
                <Link
                  href={`/organizaciones/${organizationId}/torneos/${competitionId}/editar`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
                >
                  Editar torneo
                </Link>
                <Link
                  href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/nueva`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
                >
                  Nueva temporada
                </Link>
              </>
            )}
          </div>
        }
      />

      <Card>
        <p className="text-sm text-text-secondary">
          {competition.seasons.length} temporada
          {competition.seasons.length === 1 ? "" : "s"}
        </p>
      </Card>

      <SeasonList
        organizationId={organizationId}
        competitionId={competitionId}
        seasons={competition.seasons}
        canManage={canManage}
      />
    </div>
  );
}
