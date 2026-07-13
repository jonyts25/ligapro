import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationCompetitions } from "@/lib/competitions/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompetitionList } from "@/components/competitions/CompetitionList";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function CompetitionsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const { competitions, totalSeasons } =
    await getOrganizationCompetitions(organizationId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Torneos y temporadas"
        description={`${competitions.length} torneo${competitions.length === 1 ? "" : "s"} · ${totalSeasons} temporada${totalSeasons === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/torneos/nuevo`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nuevo torneo
            </Link>
          ) : undefined
        }
      />
      <CompetitionList
        organizationId={organizationId}
        competitions={competitions}
        canManage={canManage}
      />
    </div>
  );
}
