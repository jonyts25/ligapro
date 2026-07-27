import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { KnockoutBracketData } from "@/lib/knockout/types";
import {
  formatTieScore,
  resolveTieWinnerId,
} from "@/lib/knockout/utils";
import { cn } from "@/lib/utils/cn";

type KnockoutBracketViewProps = {
  data: KnockoutBracketData;
  organizationId?: string;
  competitionId?: string;
  seasonId?: string;
  showMatchLinks?: boolean;
};

export function KnockoutBracketView({
  data,
  organizationId,
  competitionId,
  seasonId,
  showMatchLinks = false,
}: KnockoutBracketViewProps) {
  const base =
    organizationId && competitionId && seasonId
      ? `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`
      : null;

  if (!data.rounds.length) {
    return (
      <Card className="p-4 text-sm text-text-secondary">
        Aún no hay eliminatoria configurada para esta temporada.
      </Card>
    );
  }

  const maxRound = Math.max(...data.rounds.map((r) => r.roundNumber));

  return (
    <div className="space-y-6">
      {data.championTeamName && (
        <Card className="border-organization-accent/30 bg-organization-accent/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Campeón
          </p>
          <p className="text-xl font-semibold text-text-primary">
            {data.championTeamName}
          </p>
        </Card>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {data.rounds.map((round) => (
            <div
              key={round.id}
              className="flex w-56 shrink-0 flex-col gap-3"
            >
              <div className="sticky top-0 z-10 rounded-xl border border-border bg-surface px-3 py-2">
                <p className="text-sm font-semibold text-text-primary">
                  {round.roundLabel}
                </p>
                <p className="text-xs text-muted">
                  Ronda {round.roundNumber}
                  {round.isTwoLegs ? " · Ida y vuelta" : " · Partido único"}
                </p>
              </div>

              {round.ties.map((tie) => {
                const winnerId = resolveTieWinnerId(tie, round.isTwoLegs);
                const score = formatTieScore(tie, round.isTwoLegs);
                const isBye = tie.awaySeasonTeamId == null;
                const firstMatch = tie.matches[0];

                return (
                  <Card
                    key={tie.id}
                    className={cn(
                      "space-y-2 p-3",
                      winnerId && "ring-1 ring-organization-accent/20"
                    )}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      Llave {tie.bracketSlot}
                    </p>
                    <div className="space-y-1 text-sm">
                      <p
                        className={cn(
                          "font-medium",
                          winnerId === tie.homeSeasonTeamId
                            ? "text-organization-accent"
                            : "text-text-primary"
                        )}
                      >
                        {tie.homeTeamName}
                      </p>
                      {isBye ? (
                        <p className="text-xs italic text-muted">
                          Pase directo (bye)
                        </p>
                      ) : (
                        <p
                          className={cn(
                            "font-medium",
                            winnerId === tie.awaySeasonTeamId
                              ? "text-organization-accent"
                              : "text-text-primary"
                          )}
                        >
                          {tie.awayTeamName}
                        </p>
                      )}
                    </div>
                    {score && !isBye && (
                      <p className="text-sm font-semibold text-text-secondary">
                        {score}
                      </p>
                    )}
                    {tie.penaltyWinnerSeasonTeamId && (
                      <StatusBadge
                        label="Def. por penales"
                        variant="info"
                      />
                    )}
                    {showMatchLinks &&
                      base &&
                      firstMatch &&
                      !isBye && (
                        <Link
                          href={`${base}/partidos/${firstMatch.id}`}
                          className="inline-flex text-xs font-medium text-organization-accent underline-offset-2 hover:underline"
                        >
                          Ver partido
                        </Link>
                      )}
                  </Card>
                );
              })}

              {round.roundNumber < maxRound && (
                <p className="px-1 text-xs text-muted">
                  La ronda {round.roundNumber + 1} se genera cuando todas las
                  llaves de esta ronda estén resueltas.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
