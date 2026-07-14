import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTableContainer } from "@/components/ui/ResponsiveTableContainer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { suspensionStatusLabel } from "@/lib/standings/types";

export type DisciplineDisplayRow = {
  key: string;
  playerName: string;
  teamName: string;
  yellowCards?: number;
  redCards?: number;
  isSuspended?: boolean;
  matchesRemaining: number;
  suspensionStatus?: string | null;
};

type DisciplineTableProps = {
  rows: DisciplineDisplayRow[];
  publicMode?: boolean;
};

export function DisciplineTable({
  rows,
  publicMode = false,
}: DisciplineTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin disciplina registrada"
        description={
          publicMode
            ? "No hay suspensiones activas publicadas."
            : "Aquí aparecen tarjetas y suspensiones capturadas en la temporada."
        }
      />
    );
  }

  return (
    <ResponsiveTableContainer label="Resumen de disciplina">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Jugador</th>
            <th className="px-3 py-2 font-medium">Equipo</th>
            {!publicMode && (
              <>
                <th className="px-3 py-2 font-medium">TA</th>
                <th className="px-3 py-2 font-medium">TR</th>
              </>
            )}
            <th className="px-3 py-2 font-medium">Suspensión</th>
            <th className="px-3 py-2 font-medium">Restantes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const suspended =
              row.isSuspended ||
              (row.suspensionStatus === "active" &&
                (row.matchesRemaining ?? 0) > 0);
            return (
              <tr key={row.key} className="border-t border-border">
                <td className="px-3 py-3 font-medium text-text-primary">
                  {row.playerName}
                </td>
                <td className="px-3 py-3 text-text-secondary">{row.teamName}</td>
                {!publicMode && (
                  <>
                    <td className="px-3 py-3">
                      {(row.yellowCards ?? 0) > 0 ? (
                        <StatusBadge
                          label={String(row.yellowCards)}
                          variant="yellow-card"
                        />
                      ) : (
                        <span className="text-text-secondary">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {(row.redCards ?? 0) > 0 ? (
                        <StatusBadge
                          label={String(row.redCards)}
                          variant="red-card"
                        />
                      ) : (
                        <span className="text-text-secondary">0</span>
                      )}
                    </td>
                  </>
                )}
                <td className="px-3 py-3">
                  {suspended ? (
                    <StatusBadge label="Suspendido" variant="danger" />
                  ) : (
                    <span className="text-text-secondary">
                      {publicMode
                        ? "—"
                        : suspensionStatusLabel(row.suspensionStatus ?? null)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-text-secondary">
                  {row.matchesRemaining > 0 ? row.matchesRemaining : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ResponsiveTableContainer>
  );
}
