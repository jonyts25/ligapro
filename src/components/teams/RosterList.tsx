import { RosterPlayerCard } from "@/components/teams/RosterPlayerCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RosterListItem } from "@/lib/teams/types";

type RosterListProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  teamLabel: string;
  roster: RosterListItem[];
  canManage: boolean;
};

export function RosterList({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  teamLabel,
  roster,
  canManage,
}: RosterListProps) {
  const hasCaptain = roster.some((p) => p.is_captain);
  const hasViceCaptain = roster.some((p) => p.is_vice_captain);

  if (roster.length === 0) {
    return (
      <EmptyState
        title="Plantel vacío"
        description="Agrega jugadores para completar el plantel de este equipo en la temporada."
      />
    );
  }

  return (
    <ul className="space-y-4">
      {roster.map((player) => (
        <li key={player.id}>
          <RosterPlayerCard
            organizationId={organizationId}
            competitionId={competitionId}
            seasonId={seasonId}
            seasonTeamId={seasonTeamId}
            teamLabel={teamLabel}
            player={player}
            canManage={canManage}
            hasCaptain={hasCaptain}
            hasViceCaptain={hasViceCaptain}
          />
        </li>
      ))}
    </ul>
  );
}
