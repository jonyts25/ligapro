import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  formatLabel,
  visibilityBadgeVariant,
  visibilityLabel,
} from "@/lib/competitions/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { SeasonRulesSummary } from "@/components/competitions/SeasonRulesSummary";
import { SeasonReadinessCard } from "@/components/competitions/SeasonReadinessCard";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
  }>;
};

export default async function SeasonDetailPage({ params }: PageProps) {
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={season.name}
        description={`Torneo: ${season.competitionName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/organizaciones/${organizationId}/torneos/${competitionId}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
            >
              Volver al torneo
            </Link>
            {canManage && (
              <Link
                href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/oficiales`}
                className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
              >
                Oficiales
              </Link>
            )}
            {canManage && (
              <Link
                href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/editar`}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Editar temporada
              </Link>
            )}
          </div>
        }
      />

      <Card className="flex flex-wrap items-center gap-3">
        <StatusBadge
          label={visibilityLabel(season.visibility)}
          variant={visibilityBadgeVariant(season.visibility)}
        />
        <span className="text-sm text-text-secondary">
          {formatLabel(season.format_type)}
        </span>
        <span className="text-sm text-muted">
          {season.starts_on || season.ends_on
            ? `${season.starts_on ?? "—"} → ${season.ends_on ?? "—"}`
            : "Sin fechas"}
        </span>
        {season.teamCount === 0 && (
          <StatusBadge label="Pendiente de equipos" variant="warning" />
        )}
      </Card>

      <SeasonRulesSummary rules={season.rules} />
      <SeasonReadinessCard
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        season={season}
        canManage={canManage}
      />
    </div>
  );
}
