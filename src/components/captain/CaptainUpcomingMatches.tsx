import Link from "next/link";
import type { CaptainMatchListItem } from "@/lib/captain/types";
import { formatMatchDateTime } from "@/lib/fixtures/format";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

type CaptainUpcomingMatchesProps = {
  seasonTeamId: string;
  matches: CaptainMatchListItem[];
};

export function CaptainUpcomingMatches({
  seasonTeamId,
  matches,
}: CaptainUpcomingMatchesProps) {
  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Próximos partidos"
        description="Partidos de tu equipo con estado de calendario."
      />
      {matches.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No hay partidos próximos programados todavía.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {matches.map((match) => (
            <li key={match.id} className="py-3 first:pt-0 last:pb-0">
              <Link
                href={`/mi-equipo/${seasonTeamId}/partidos/${match.id}`}
                className="block rounded-xl transition hover:bg-surface-elevated/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 px-1 py-1">
                  <div>
                    <p className="font-medium">
                      {match.isOwnHome ? "vs" : "@"} {match.opponentName}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Jornada {match.roundNumber ?? "—"}
                      {match.legNumber ? ` · Vuelta ${match.legNumber}` : ""}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {match.isProgrammed
                        ? formatMatchDateTime(match.startsAt)
                        : "Sin programación"}
                      {match.venueName || match.fieldName
                        ? ` · ${[match.venueName, match.fieldName].filter(Boolean).join(" · ")}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge
                    label={
                      match.calendarStatus === "confirmado"
                        ? "Confirmado"
                        : "Programado"
                    }
                    variant={
                      match.calendarStatus === "confirmado"
                        ? "success"
                        : "default"
                    }
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
