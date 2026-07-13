import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { getCompetitionWithSeasons } from "@/lib/competitions/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompetitionForm } from "@/components/competitions/CompetitionForm";

type PageProps = {
  params: Promise<{ organizationId: string; competitionId: string }>;
};

export default async function EditCompetitionPage({ params }: PageProps) {
  const { organizationId, competitionId } = await params;
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const competition = await getCompetitionWithSeasons(
    organizationId,
    competitionId
  );
  if (!competition) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Editar torneo"
        description={competition.name}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        }
      />
      <CompetitionForm
        organizationId={organizationId}
        mode="edit"
        competition={competition}
      />
    </div>
  );
}
