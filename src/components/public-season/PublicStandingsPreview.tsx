import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTableContainer } from "@/components/ui/ResponsiveTableContainer";
import { TeamFormBadge } from "@/components/standings/TeamFormBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { PublicStandingRow } from "@/lib/public-season/types";

type PublicStandingsPreviewProps = {
  rows: PublicStandingRow[];
  organizationId: string;
  seasonSlug: string;
  limit?: number;
};

export function PublicStandingsPreview({
  rows,
  organizationId,
  seasonSlug,
  limit = 5,
}: PublicStandingsPreviewProps) {
  const preview = rows.slice(0, limit);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionHeader
          title="Posiciones"
          description="Clasificación con marcador oficial."
        />
        {rows.length > 0 && (
          <Link
            href={`/publico/${organizationId}/${seasonSlug}/posiciones`}
            className="text-sm font-medium text-organization-accent underline-offset-2 hover:underline"
          >
            Ver tabla completa
          </Link>
        )}
      </div>

      {preview.length === 0 ? (
        <EmptyState
          title="Sin posiciones aún"
          description="Cuando haya resultados oficiales se mostrará la tabla."
        />
      ) : (
        <ResponsiveTableContainer label="Vista previa de posiciones">
          <table className="w-full min-w-[24rem] text-left text-sm">
            <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Equipo</th>
                <th className="px-3 py-2 font-medium">PJ</th>
                <th className="px-3 py-2 font-medium">Pts</th>
                <th className="px-3 py-2 font-medium">Forma</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr
                  key={`${row.position}-${row.teamName}`}
                  className="border-t border-border"
                >
                  <td className="px-3 py-3 font-medium">{row.position}</td>
                  <td className="px-3 py-3 font-medium text-text-primary">
                    {row.teamName}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{row.played}</td>
                  <td className="px-3 py-3 font-semibold">{row.points}</td>
                  <td className="px-3 py-3">
                    <TeamFormBadge recentForm={row.recentForm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableContainer>
      )}
    </section>
  );
}
