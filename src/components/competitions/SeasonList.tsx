import Link from "next/link";
import { SeasonCard } from "@/components/competitions/SeasonCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { splitSeasonsByArchive } from "@/lib/competitions/season-visibility";
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
  const { active, archived } = splitSeasonsByArchive(seasons);

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
    <div className="space-y-8">
      <section className="space-y-4">
        {archived.length > 0 && (
          <SectionHeader
            title="Temporadas activas"
            description="Gestión operativa habitual."
          />
        )}
        {active.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No hay temporadas activas. Consulta las archivadas abajo o crea una
            nueva.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {active.map((season) => (
              <li key={season.id}>
                <SeasonCard
                  organizationId={organizationId}
                  competitionId={competitionId}
                  season={season}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title="Temporadas archivadas"
            description="Solo lectura. Los datos históricos se conservan."
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {archived.map((season) => (
              <li key={season.id}>
                <SeasonCard
                  organizationId={organizationId}
                  competitionId={competitionId}
                  season={season}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
