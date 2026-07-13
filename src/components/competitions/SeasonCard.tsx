import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import {
  formatLabel,
  visibilityBadgeVariant,
  visibilityLabel,
  type SeasonListItem,
} from "@/lib/competitions/types";

type SeasonCardProps = {
  organizationId: string;
  competitionId: string;
  season: SeasonListItem;
};

export function SeasonCard({
  organizationId,
  competitionId,
  season,
}: SeasonCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-text-primary">
          {season.name}
        </h3>
        <StatusBadge
          label={visibilityLabel(season.visibility)}
          variant={visibilityBadgeVariant(season.visibility)}
        />
      </div>
      <p className="text-sm text-text-secondary">
        {formatLabel(season.format_type)}
      </p>
      <p className="text-sm text-muted">
        {season.starts_on || season.ends_on
          ? `${season.starts_on ?? "—"} → ${season.ends_on ?? "—"}`
          : "Sin fechas definidas"}
      </p>
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          label={
            season.teamCount === 0
              ? "Pendiente de equipos"
              : `${season.teamCount} equipo${season.teamCount === 1 ? "" : "s"}`
          }
          variant={season.teamCount === 0 ? "warning" : "success"}
        />
      </div>
      <Link
        href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${season.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-organization-accent"
      >
        Ver temporada
      </Link>
    </Card>
  );
}
