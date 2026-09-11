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

export default async function OrganizationCalendarHubPage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  const user = await requireUser();
  await requireOrganizationMembership(user.id, organizationId);

  const seasons = await listOrganizationSeasonOptions(organizationId);
  const defaultSeason = pickDefaultOrganizationSeason(seasons);

  if (defaultSeason) {
    redirect(
      buildOrganizationScopedHref(organizationId, "calendario", defaultSeason)
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Calendario"
        description="Programa jornadas y partidos de tus torneos."
      />
      <EmptyState
        title="Sin torneos activos"
        description="Crea un torneo para generar el calendario de partidos."
      />
    </div>
  );
}
