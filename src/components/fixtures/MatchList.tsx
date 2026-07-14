import { MatchCard } from "@/components/fixtures/MatchCard";
import type { MatchListItem } from "@/lib/fixtures/types";

type MatchListProps = {
  matches: MatchListItem[];
  organizationId: string;
  competitionId: string;
  seasonId: string;
  canManage?: boolean;
  emptyLabel?: string;
};

export function MatchList({
  matches,
  organizationId,
  competitionId,
  seasonId,
  canManage = false,
  emptyLabel = "No hay partidos en esta vista.",
}: MatchListProps) {
  if (!matches.length) {
    return <p className="text-sm text-text-secondary">{emptyLabel}</p>;
  }

  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  return (
    <ul className="space-y-3">
      {matches.map((match) => (
        <li key={match.id}>
          <MatchCard
            match={match}
            href={`${base}/partidos/${match.id}`}
            scheduleHref={`${base}/partidos/${match.id}/programar`}
            canManage={canManage}
          />
        </li>
      ))}
    </ul>
  );
}
