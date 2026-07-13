import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getTeamDetails } from "@/lib/teams/queries";
import {
  displaySeasonTeamName,
  seasonTeamStatusLabel,
  seasonTeamStatusVariant,
} from "@/lib/teams/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";

type PageProps = {
  params: Promise<{ organizationId: string; teamId: string }>;
};

export default async function TeamDetailPage({ params }: PageProps) {
  const { organizationId, teamId } = await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const team = await getTeamDetails(organizationId, teamId);
  if (!team) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={team.name}
        description="Equipo persistente de la organización."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organizaciones/${organizationId}/equipos`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Todos los equipos
            </Link>
            {canManage && (
              <Link
                href={`/organizaciones/${organizationId}/equipos/${teamId}/editar`}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Editar equipo
              </Link>
            )}
          </div>
        }
      />

      <Card>
        <SectionHeader
          title="Temporadas"
          description="Inscripciones de este equipo. El plantel vive en cada temporada."
        />
        {team.enrollments.length === 0 ? (
          <EmptyState
            title="Sin inscripciones"
            description="Inscribe este equipo desde el detalle de una temporada."
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {team.enrollments.map((enrollment) => (
              <li key={enrollment.seasonTeamId}>
                <Link
                  href={`/organizaciones/${organizationId}/torneos/${enrollment.competitionId}/temporadas/${enrollment.seasonId}/equipos/${enrollment.seasonTeamId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 hover:bg-surface-elevated"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {enrollment.competitionName} · {enrollment.seasonName}
                    </p>
                    <p className="text-xs text-muted">
                      {displaySeasonTeamName(null, team.name)}
                    </p>
                  </div>
                  <StatusBadge
                    label={seasonTeamStatusLabel(enrollment.registration_status)}
                    variant={seasonTeamStatusVariant(
                      enrollment.registration_status
                    )}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
