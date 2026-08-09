import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MatchList } from "@/components/fixtures/MatchList";
import type { FixtureRoundGroup } from "@/lib/fixtures/types";

import { JornadaSummaryPanel } from "@/components/jornada-summaries/JornadaSummaryPanel";
import type { JornadaSummaryRecord } from "@/lib/jornada-summaries/types";

type FixtureRoundCardProps = {
  round: FixtureRoundGroup;
  organizationId: string;
  competitionId: string;
  seasonId: string;
  canManage?: boolean;
  canCapture?: boolean;
  hasPremium?: boolean;
  jornadaSummary?: JornadaSummaryRecord | null;
  jornadaJob?: { status: string; error_message: string | null } | null;
};

export function FixtureRoundCard({
  round,
  organizationId,
  competitionId,
  seasonId,
  canManage = false,
  canCapture = false,
  hasPremium = false,
  jornadaSummary = null,
  jornadaJob = null,
}: FixtureRoundCardProps) {
  const hasFinishedMatches = round.matches.some(
    (m) =>
      (m.status === "finished" || m.status === "walkover") &&
      m.homeScore != null &&
      m.awayScore != null
  );

  return (
    <Card className="space-y-4">
      <SectionHeader
        title={`Jornada ${round.roundNumber}`}
        description={
          round.legNumber
            ? `Vuelta ${round.legNumber} · ${round.matches.length} partido${round.matches.length === 1 ? "" : "s"}`
            : `${round.matches.length} partido${round.matches.length === 1 ? "" : "s"}`
        }
      />
      {round.byeNames.length > 0 && (
        <p className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-text-secondary">
          Descansa: {round.byeNames.join(", ")}
        </p>
      )}
      <MatchList
        matches={round.matches}
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        canManage={canManage}
        canCapture={canCapture}
      />
      <JornadaSummaryPanel
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        roundNumber={round.roundNumber}
        hasPremium={hasPremium}
        canManage={canManage}
        summary={jornadaSummary}
        job={
          jornadaJob
            ? {
                status: jornadaJob.status as
                  | "pending"
                  | "processing"
                  | "done"
                  | "error",
                error_message: jornadaJob.error_message,
              }
            : null
        }
        hasFinishedMatches={hasFinishedMatches}
      />
    </Card>
  );
}
