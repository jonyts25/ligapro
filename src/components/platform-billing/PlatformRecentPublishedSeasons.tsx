import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { RecentPublishedSeason } from "@/lib/platform/queries";

type PlatformRecentPublishedSeasonsProps = {
  seasons: RecentPublishedSeason[];
};

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function PlatformRecentPublishedSeasons({
  seasons,
}: PlatformRecentPublishedSeasonsProps) {
  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold">Temporadas publicadas recientemente</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Vista interna para revisar qué temporadas quedaron públicas en la
          plataforma.
        </p>
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-muted">No hay temporadas públicas todavía.</p>
      ) : (
        <ul className="divide-y divide-border">
          {seasons.map((season) => (
            <li key={season.seasonId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-text-primary">{season.seasonName}</p>
                <p className="text-sm text-text-secondary">
                  {season.organizationName} · {season.competitionName}
                </p>
                <p className="text-xs text-muted">
                  Actualizada {formatUpdatedAt(season.updatedAt)}
                </p>
              </div>
              <Link
                href={season.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-surface-elevated"
              >
                Ver pública
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
