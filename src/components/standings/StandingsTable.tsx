import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTableContainer } from "@/components/ui/ResponsiveTableContainer";
import { TeamFormBadge } from "@/components/standings/TeamFormBadge";
import { seasonTeamStatusLabel } from "@/lib/standings/types";

export type StandingsDisplayRow = {
  key: string;
  position: number;
  teamName: string;
  registrationStatus?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  recentForm: string;
};

type StandingsTableProps = {
  rows: StandingsDisplayRow[];
  compact?: boolean;
};

export function StandingsTable({ rows, compact = false }: StandingsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin posiciones aún"
        description="La tabla se calcula con partidos finalizados o walkover que tengan marcador oficial."
      />
    );
  }

  return (
    <ResponsiveTableContainer label="Tabla de posiciones">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Equipo</th>
            {!compact && <th className="px-3 py-2 font-medium">PJ</th>}
            <th className="px-3 py-2 font-medium">G</th>
            <th className="px-3 py-2 font-medium">E</th>
            <th className="px-3 py-2 font-medium">P</th>
            {!compact && (
              <>
                <th className="px-3 py-2 font-medium">GF</th>
                <th className="px-3 py-2 font-medium">GC</th>
                <th className="px-3 py-2 font-medium">DG</th>
              </>
            )}
            <th className="px-3 py-2 font-medium">Pts</th>
            <th className="px-3 py-2 font-medium">Forma</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-3 py-3 font-medium text-text-primary">
                {row.position}
              </td>
              <td className="px-3 py-3 text-text-primary">
                <span className="font-medium">{row.teamName}</span>
                {row.registrationStatus === "withdrawn" && (
                  <span className="ml-2 text-xs text-muted">
                    ({seasonTeamStatusLabel(row.registrationStatus)})
                  </span>
                )}
              </td>
              {!compact && (
                <td className="px-3 py-3 text-text-secondary">{row.played}</td>
              )}
              <td className="px-3 py-3 text-text-secondary">{row.won}</td>
              <td className="px-3 py-3 text-text-secondary">{row.drawn}</td>
              <td className="px-3 py-3 text-text-secondary">{row.lost}</td>
              {!compact && (
                <>
                  <td className="px-3 py-3 text-text-secondary">
                    {row.goalsFor}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {row.goalsAgainst}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {row.goalDifference > 0
                      ? `+${row.goalDifference}`
                      : row.goalDifference}
                  </td>
                </>
              )}
              <td className="px-3 py-3 font-semibold text-text-primary">
                {row.points}
              </td>
              <td className="px-3 py-3">
                <TeamFormBadge recentForm={row.recentForm} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTableContainer>
  );
}
