import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PublicSeasonShell } from "@/components/public-season/PublicSeasonShell";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { matchStatusLabel } from "@/lib/matches/types";
import { getPublicSeasonMatches } from "@/lib/public-season/queries";

type PageProps = {
  params: Promise<{
    organizationId: string;
    seasonSlug: string;
  }>;
};

export default async function PublicSeasonCalendarPage({ params }: PageProps) {
  const { organizationId, seasonSlug } = await params;
  const matches = await getPublicSeasonMatches(organizationId, seasonSlug);

  const byRound = new Map<string, typeof matches>();
  for (const match of matches) {
    const key =
      match.roundLabel ??
      (match.roundNumber != null
        ? `Jornada ${match.roundNumber}`
        : "Sin jornada");
    const list = byRound.get(key) ?? [];
    list.push(match);
    byRound.set(key, list);
  }

  return (
    <PublicSeasonShell
      organizationId={organizationId}
      seasonSlug={seasonSlug}
      active="calendario"
    >
      <SectionHeader
        title="Calendario"
        description="Partidos de la temporada (solo lectura)."
      />

      {matches.length === 0 ? (
        <EmptyState
          title="Sin partidos publicados"
          description="Cuando exista fixture, el calendario aparecerá aquí."
        />
      ) : (
        <div className="space-y-6">
          {[...byRound.entries()].map(([round, roundMatches]) => (
            <section key={round} className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">
                {round}
              </h2>
              <ul className="space-y-3">
                {roundMatches.map((match, index) => {
                  const scoreText =
                    match.homeScore != null && match.awayScore != null
                      ? `${match.homeScore}–${match.awayScore}`
                      : null;
                  const place = [match.venueName, match.fieldName]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={`${round}-${match.homeTeamName}-${match.awayTeamName}-${index}`}
                    >
                      <Card className="space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-text-primary">
                            {match.homeTeamName}{" "}
                            <span className="font-normal text-muted">
                              {scoreText ?? "vs"}
                            </span>{" "}
                            {match.awayTeamName}
                          </p>
                          <StatusBadge
                            label={matchStatusLabel(match.status)}
                            variant={
                              match.status === "finished" ||
                              match.status === "walkover"
                                ? "finished"
                                : match.status === "in_progress"
                                  ? "live"
                                  : "scheduled"
                            }
                          />
                        </div>
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
            </section>
          ))}
        </div>
      )}
    </PublicSeasonShell>
  );
}
