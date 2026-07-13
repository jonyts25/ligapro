import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamForm } from "@/components/teams/TeamForm";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewTeamPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nuevo equipo"
        description="Crea un equipo persistente para inscribirlo en temporadas."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/equipos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <TeamForm organizationId={organizationId} mode="create" />
    </div>
  );
}
