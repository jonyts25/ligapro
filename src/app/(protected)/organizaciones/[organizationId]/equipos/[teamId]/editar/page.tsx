import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getTeamDetails } from "@/lib/teams/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamForm } from "@/components/teams/TeamForm";

type PageProps = {
  params: Promise<{ organizationId: string; teamId: string }>;
};

export default async function EditTeamPage({ params }: PageProps) {
  const { organizationId, teamId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const team = await getTeamDetails(organizationId, teamId);
  if (!team) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Editar equipo"
        description={team.name}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/equipos/${teamId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <TeamForm organizationId={organizationId} mode="edit" team={team} />
    </div>
  );
}
