import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import {
  getAvailablePlayersForRoster,
  getSeasonTeamRoster,
} from "@/lib/teams/queries";
import {
  displaySeasonTeamName,
  seasonTeamStatusLabel,
  seasonTeamStatusVariant,
} from "@/lib/teams/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SeasonRosterSummary } from "@/components/teams/SeasonRosterSummary";
import { RosterList } from "@/components/teams/RosterList";
import { AddRosterPlayerForm } from "@/components/teams/AddRosterPlayerForm";

type PageProps = {
  params: Promise<{
    organizationId: string;
    competitionId: string;
    seasonId: string;
    seasonTeamId: string;
  }>;
};

export default async function SeasonTeamRosterPage({ params }: PageProps) {
  const { organizationId, competitionId, seasonId, seasonTeamId } =
    await params;
  const user = await requireUser();
  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );
  const canManage =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";

  const detail = await getSeasonTeamRoster(
    organizationId,
    competitionId,
    seasonId,
    seasonTeamId
  );
  if (!detail) notFound();

  const availablePlayers = canManage
    ? await getAvailablePlayersForRoster(organizationId, seasonTeamId)
    : [];

  const title = displaySeasonTeamName(detail.display_name, detail.teamName);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={title}
        description={`${detail.competitionName} · ${detail.seasonName}`}
        actions={
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Equipos de la temporada
          </Link>
        }
      />

      <Card className="flex flex-wrap items-center gap-3">
        <StatusBadge
          label={seasonTeamStatusLabel(detail.registration_status)}
          variant={seasonTeamStatusVariant(detail.registration_status)}
        />
        {detail.group_name && (
          <span className="text-sm text-muted">Grupo: {detail.group_name}</span>
        )}
        <span className="text-sm text-text-secondary">
          Equipo base: {detail.teamName}
        </span>
      </Card>

      <SeasonRosterSummary seasonTeam={detail} />

      <RosterList
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        seasonTeamId={seasonTeamId}
        roster={detail.roster}
        canManage={canManage}
      />

      {canManage && (
        <AddRosterPlayerForm
          organizationId={organizationId}
          competitionId={competitionId}
          seasonId={seasonId}
          seasonTeamId={seasonTeamId}
          availablePlayers={availablePlayers}
        />
      )}
    </div>
  );
}
