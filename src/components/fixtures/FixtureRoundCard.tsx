import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MatchList } from "@/components/fixtures/MatchList";
import type { FixtureRoundGroup } from "@/lib/fixtures/types";

type FixtureRoundCardProps = {
  round: FixtureRoundGroup;
  organizationId: string;
  competitionId: string;
  seasonId: string;
  canManage?: boolean;
};

export function FixtureRoundCard({
  round,
  organizationId,
  competitionId,
  seasonId,
  canManage = false,
}: FixtureRoundCardProps) {
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
      />
    </Card>
  );
}
