import Link from "next/link";
import { SeasonCard } from "@/components/competitions/SeasonCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SeasonListItem } from "@/lib/competitions/types";

type SeasonListProps = {
  organizationId: string;
  competitionId: string;
  seasons: SeasonListItem[];
  canManage: boolean;
};

export function SeasonList({
  organizationId,
  competitionId,
  seasons,
  canManage,
}: SeasonListProps) {
  if (seasons.length === 0) {
    return (
      <EmptyState
        title="Sin temporadas"
        description="Crea una temporada para definir formato, fechas y reglas."
        action={
          canManage ? (
            <Link
              href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/nueva`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Nueva temporada
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {seasons.map((season) => (
        <li key={season.id}>
          <SeasonCard
            organizationId={organizationId}
            competitionId={competitionId}
            season={season}
          />
        </li>
      ))}
    </ul>
  );
}
