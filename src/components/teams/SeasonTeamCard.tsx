import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import {
  displaySeasonTeamName,
  seasonTeamStatusLabel,
  seasonTeamStatusVariant,
  type SeasonTeamListItem,
} from "@/lib/teams/types";

type SeasonTeamCardProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeam: SeasonTeamListItem;
};

export function SeasonTeamCard({
  organizationId,
  competitionId,
  seasonId,
  seasonTeam,
}: SeasonTeamCardProps) {
  const displayName = displaySeasonTeamName(
    seasonTeam.display_name,
    seasonTeam.teamName
  );
  const playerLabel =
    seasonTeam.playerCount === 1
      ? "1 jugador"
      : `${seasonTeam.playerCount} jugadores`;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-text-primary">
            {displayName}
          </h3>
          {seasonTeam.display_name?.trim() && (
            <p className="mt-0.5 truncate text-sm text-muted">
              {seasonTeam.teamName}
            </p>
          )}
        </div>
        <StatusBadge
          label={seasonTeamStatusLabel(seasonTeam.registration_status)}
          variant={seasonTeamStatusVariant(seasonTeam.registration_status)}
        />
      </div>
      <p className="text-sm text-text-secondary">{playerLabel}</p>
      <p className="text-sm text-muted">
        Capitán:{" "}
        <span className="font-medium text-text-primary">
          {seasonTeam.captainName ?? "Sin asignar"}
        </span>
      </p>
      {seasonTeam.group_name?.trim() && (
        <p className="text-sm text-text-secondary">
          Grupo: {seasonTeam.group_name}
        </p>
      )}
      <Link
        href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos/${seasonTeam.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent hover:bg-surface-elevated"
      >
        Ver plantel
      </Link>
    </Card>
  );
}
