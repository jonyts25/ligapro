import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { SeasonFixtureStats } from "@/lib/fixtures/types";

type SeasonFixtureSummaryProps = {
  stats: SeasonFixtureStats;
};

export function SeasonFixtureSummary({ stats }: SeasonFixtureSummaryProps) {
  return (
    <Card className="space-y-3">
      <SectionHeader
        title="Fixture"
        description="Partidos generados y programación."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <StatusBadge
          label={stats.fixtureGenerated ? "Generado" : "Sin fixture"}
          variant={stats.fixtureGenerated ? "success" : "warning"}
        />
        <span className="text-text-secondary">
          Total: {stats.totalMatches}
        </span>
        <span className="text-text-secondary">
          Programados: {stats.scheduledMatches}
        </span>
        <span className="text-text-secondary">
          Pendientes: {stats.pendingMatches}
        </span>
      </div>
    </Card>
  );
}
