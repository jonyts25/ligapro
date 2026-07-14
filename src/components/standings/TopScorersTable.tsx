import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTableContainer } from "@/components/ui/ResponsiveTableContainer";

export type ScorerDisplayRow = {
  key: string;
  position: number;
  playerName: string;
  teamName: string;
  goals: number;
};

type TopScorersTableProps = {
  rows: ScorerDisplayRow[];
};

export function TopScorersTable({ rows }: TopScorersTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin goles registrados"
        description="Los goleadores se cuentan con eventos de tipo gol capturados en los partidos."
      />
    );
  }

  return (
    <ResponsiveTableContainer label="Tabla de goleadores">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Jugador</th>
            <th className="px-3 py-2 font-medium">Equipo</th>
            <th className="px-3 py-2 font-medium">Goles</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-3 py-3 font-medium text-text-primary">
                {row.position}
              </td>
              <td className="px-3 py-3 font-medium text-text-primary">
                {row.playerName}
              </td>
              <td className="px-3 py-3 text-text-secondary">{row.teamName}</td>
              <td className="px-3 py-3 font-semibold text-text-primary">
                {row.goals}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTableContainer>
  );
}
