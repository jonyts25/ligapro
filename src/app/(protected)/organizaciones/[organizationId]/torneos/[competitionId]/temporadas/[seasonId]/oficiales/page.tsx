import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  getOrganizationMemberOptions,
  getSeasonOperationalRoles,
} from "@/lib/matches/queries";
import { SeasonRoleManager } from "@/components/matches/SeasonRoleManager";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonOfficialsPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) notFound();

  const [members, roles] = await Promise.all([
    getOrganizationMemberOptions(organizationId),
    getSeasonOperationalRoles(organizationId, seasonId),
  ]);

  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Oficiales de temporada"
        description={season.name}
        actions={
          <Link
            href={base}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Volver
          </Link>
        }
      />
      {!canManage && (
        <p className="text-sm text-text-secondary">
          Solo lectura. Owner/admin asignan roles.
        </p>
      )}
      <SeasonRoleManager
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        members={members}
        roles={roles}
        canManage={canManage}
      />
    </div>
  );
}
