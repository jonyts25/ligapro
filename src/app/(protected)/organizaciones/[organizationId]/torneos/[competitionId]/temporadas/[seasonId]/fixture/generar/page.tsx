import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  isSeasonArchived,
  seasonDetailPath,
} from "@/lib/competitions/season-visibility";
import { getSeasonFixtureContext } from "@/lib/fixtures/queries";
import { FixtureGeneratorForm } from "@/components/fixtures/FixtureGeneratorForm";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function GenerateFixturePage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  if (!canManage) notFound();

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();
  if (isSeasonArchived(season.visibility)) {
    redirect(seasonDetailPath(organizationId, competitionId, seasonId));
  }

  const context = await getSeasonFixtureContext(
    organizationId,
    competitionId,
    seasonId
  );
  if (!context) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Generar fixture"
        description={`${context.seasonName} · ${context.competitionName}`}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Volver
          </Link>
        }
      />
      <FixtureGeneratorForm context={context} />
    </div>
  );
}
