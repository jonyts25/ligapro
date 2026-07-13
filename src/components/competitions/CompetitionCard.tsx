import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import {
  formatLabel,
  visibilityBadgeVariant,
  visibilityLabel,
  type CompetitionListItem,
} from "@/lib/competitions/types";

type CompetitionCardProps = {
  organizationId: string;
  competition: CompetitionListItem;
};

export function CompetitionCard({
  organizationId,
  competition,
}: CompetitionCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-text-primary">
          {competition.name}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {competition.seasonCount === 1
            ? "1 temporada"
            : `${competition.seasonCount} temporadas`}
        </p>
      </div>
      {competition.latestSeason ? (
        <div className="space-y-1 text-sm text-text-secondary">
          <p>
            Última:{" "}
            <span className="font-medium text-text-primary">
              {competition.latestSeason.name}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={visibilityLabel(competition.latestSeason.visibility)}
              variant={visibilityBadgeVariant(competition.latestSeason.visibility)}
            />
            <span className="text-xs text-muted">
              {formatLabel(competition.latestSeason.format_type)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Sin temporadas todavía</p>
      )}
      <Link
        href={`/organizaciones/${organizationId}/torneos/${competition.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent hover:bg-surface-elevated"
      >
        Ver torneo
      </Link>
    </Card>
  );
}
