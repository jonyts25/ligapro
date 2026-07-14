import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import type { PublicMatchRow } from "@/lib/public-season/types";

type PublicRecentResultsProps = {
  matches: PublicMatchRow[];
  limit?: number;
};

export function PublicRecentResults({
  matches,
  limit = 5,
}: PublicRecentResultsProps) {
  const finished = matches
    .filter(
      (m) =>
        (m.status === "finished" || m.status === "walkover") &&
        m.homeScore != null &&
        m.awayScore != null
    )
    .sort((a, b) => {
      const at = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const bt = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, limit);

  if (finished.length === 0) {
    return (
      <EmptyState
        title="Sin resultados recientes"
        description="Los partidos finalizados con marcador aparecerán aquí."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {finished.map((match, index) => {
        const winner =
          match.homeScore! > match.awayScore!
            ? `Gana ${match.homeTeamName}`
            : match.awayScore! > match.homeScore!
              ? `Gana ${match.awayTeamName}`
              : "Empate";

        return (
          <li
            key={`${match.homeTeamName}-${match.awayTeamName}-result-${index}`}
          >
            <Card className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {match.homeTeamName}{" "}
                  <span className="font-normal text-muted">
                    {match.homeScore}–{match.awayScore}
                  </span>{" "}
                  {match.awayTeamName}
                </p>
                <StatusBadge label="Finalizado" variant="finished" />
              </div>
              <p className="text-xs font-medium text-success">{winner}</p>
              <p className="text-xs text-text-secondary">
                {match.roundLabel ??
                  (match.roundNumber
                    ? `Jornada ${match.roundNumber}`
                    : "Sin jornada")}
                {match.startsAt ? ` · ${formatMatchDateTime(match.startsAt)}` : ""}
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
