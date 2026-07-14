import Link from "next/link";
import type { ScoreMismatchRow } from "@/lib/standings/types";

type ScoreEventsMismatchAlertProps = {
  mismatches: ScoreMismatchRow[];
  organizationId: string;
  competitionId: string;
  seasonId: string;
};

export function ScoreEventsMismatchAlert({
  mismatches,
  organizationId,
  competitionId,
  seasonId,
}: ScoreEventsMismatchAlertProps) {
  if (mismatches.length === 0) return null;

  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;

  return (
    <div
      role="alert"
      className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-secondary"
    >
      <p className="font-medium text-warning">
        Marcador oficial distinto a los goles de eventos
      </p>
      <p className="mt-1">
        La tabla usa el marcador oficial. Revisa estos partidos donde los
        eventos (goles y autogoles) no coinciden:
      </p>
      <ul className="mt-3 space-y-2">
        {mismatches.slice(0, 8).map((row) => (
          <li key={row.matchId}>
            <Link
              href={`${base}/partidos/${row.matchId}`}
              className="font-medium text-text-primary underline-offset-2 hover:underline"
            >
              {row.homeName} {row.officialHome}–{row.officialAway}{" "}
              {row.awayName}
            </Link>
            <span className="ml-2 text-xs text-muted">
              Eventos: {row.eventsHome}–{row.eventsAway}
            </span>
          </li>
        ))}
      </ul>
      {mismatches.length > 8 && (
        <p className="mt-2 text-xs text-muted">
          Y {mismatches.length - 8} más…
        </p>
      )}
    </div>
  );
}
