import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import {
  formatLabel,
  visibilityBadgeVariant,
  type CompetitionListItem,
} from "@/lib/competitions/types";
import { displaySeasonVisibilityLabel } from "@/lib/competitions/season-visibility";

type CompetitionCardProps = {
  organizationId: string;
  competition: CompetitionListItem;
};

export function CompetitionCard({
  organizationId,
  competition,
}: CompetitionCardProps) {
  const href = competition.latestSeason
    ? `/organizaciones/${organizationId}/torneos/${competition.id}/temporadas/${competition.latestSeason.id}`
    : `/organizaciones/${organizationId}/torneos/${competition.id}`;

  return (
    <Card className="flex flex-col gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-text-primary">
          {competition.name}
        </h3>
      </div>
      {competition.latestSeason ? (
        <div className="space-y-1 text-sm text-text-secondary">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={displaySeasonVisibilityLabel(
                competition.latestSeason.visibility
              )}
              variant={visibilityBadgeVariant(
                competition.latestSeason.visibility
              )}
            />
            <span className="text-xs text-muted">
              {formatLabel(competition.latestSeason.format_type)}
            </span>
          </div>
          <p className="text-xs text-muted">
            {competition.latestSeason.teamCount} equipo
            {competition.latestSeason.teamCount === 1 ? "" : "s"} inscrito
            {competition.latestSeason.teamCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">Sin configurar todavía</p>
      )}
      <Link
        href={href}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent hover:bg-surface-elevated"
      >
        Ver torneo
      </Link>
    </Card>
  );
}
