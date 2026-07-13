import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getOrganizationTeams } from "@/lib/teams/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamList } from "@/components/teams/TeamList";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function TeamsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const teams = await getOrganizationTeams(organizationId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Equipos"
        description={`${teams.length} equipo${teams.length === 1 ? "" : "s"} registrados`}
        actions={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/equipos/nuevo`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nuevo equipo
            </Link>
          ) : undefined
        }
      />
      <TeamList
        organizationId={organizationId}
        teams={teams}
        canManage={canManage}
      />
    </div>
  );
}
