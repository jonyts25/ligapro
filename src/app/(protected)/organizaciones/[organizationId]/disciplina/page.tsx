import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { listOrganizationSeasonOptions } from "@/lib/organizations/queries";
import {
  buildOrganizationScopedHref,
  pickDefaultOrganizationSeason,
} from "@/lib/organizations/season-picker";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationDisciplineHubPage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationMembership(user.id, organizationId);

  const seasons = await listOrganizationSeasonOptions(organizationId);
  const defaultSeason = pickDefaultOrganizationSeason(seasons);

  if (defaultSeason) {
    redirect(
      buildOrganizationScopedHref(organizationId, "disciplina", defaultSeason)
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Disciplina"
        description="Tarjetas, suspensiones y sanciones por torneo."
      />
      <EmptyState
        title="Sin torneos activos"
        description="La disciplina se registra cuando hay partidos y eventos en un torneo."
      />
    </div>
  );
}
