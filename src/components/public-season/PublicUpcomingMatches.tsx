import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { matchStatusLabel } from "@/lib/matches/types";
import type { PublicMatchRow } from "@/lib/public-season/types";

type PublicUpcomingMatchesProps = {
  matches: PublicMatchRow[];
  limit?: number;
};

function isUpcomingStatus(match: PublicMatchRow): boolean {
  return match.status === "scheduled" || match.status === "in_progress";
}

export function PublicUpcomingMatches({
  matches,
  limit = 5,
}: PublicUpcomingMatchesProps) {
  const upcoming = matches
    .filter(isUpcomingStatus)
    .sort((a, b) => {
      if (!a.startsAt && !b.startsAt) return 0;
      if (!a.startsAt) return 1;
      if (!b.startsAt) return -1;
      return a.startsAt.localeCompare(b.startsAt);
    })
    .slice(0, limit);

  if (upcoming.length === 0) {
    return (
      <EmptyState
        title="Sin próximos partidos"
        description="Cuando haya partidos programados aparecerán aquí."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {upcoming.map((match, index) => {
        const place = [match.venueName, match.fieldName]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={`${match.homeTeamName}-${match.awayTeamName}-${match.startsAt}-${index}`}
          >
            <Card className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {match.homeTeamName}{" "}
                  <span className="font-normal text-muted">vs</span>{" "}
                  {match.awayTeamName}
                </p>
                <StatusBadge
                  label={matchStatusLabel(match.status)}
                  variant={
                    match.status === "in_progress" ? "live" : "scheduled"
                  }
                />
              </div>
              <p className="text-xs text-text-secondary">
                {match.roundLabel ??
                  (match.roundNumber
                    ? `Jornada ${match.roundNumber}`
                    : "Sin jornada")}
              </p>
              <p className="text-sm text-text-secondary">
                {formatMatchDateTime(match.startsAt)}
              </p>
              {place && (
                <p className="text-sm text-text-secondary">{place}</p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
