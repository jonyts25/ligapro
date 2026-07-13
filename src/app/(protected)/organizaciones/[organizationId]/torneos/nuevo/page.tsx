import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompetitionForm } from "@/components/competitions/CompetitionForm";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewCompetitionPage({ params }: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nuevo torneo"
        description="Crea la competencia sobre la que configurarás temporadas."
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <CompetitionForm organizationId={organizationId} mode="create" />
    </div>
  );
}
