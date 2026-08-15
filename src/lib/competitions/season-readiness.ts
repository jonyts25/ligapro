import type { SeasonDetail } from "@/lib/competitions/types";

export type SeasonReadinessItem = {
  label: string;
  value: string;
  ok: boolean;
};

export function getSeasonReadinessItems(
  season: Pick<SeasonDetail, "format_type" | "readiness">
): SeasonReadinessItem[] {
  const { readiness } = season;
  const formatType = season.format_type;
  const isLeague =
    formatType === "round_robin" || formatType === "round_robin_double";

  return [
    {
      label: "Sedes configuradas",
      value: String(readiness.activeVenues),
      ok: readiness.activeVenues > 0,
    },
    {
      label: "Canchas activas",
      value: String(readiness.effectiveActiveFields),
      ok: readiness.effectiveActiveFields > 0,
    },
    {
      label: "Equipos inscritos",
      value: String(readiness.teamCount),
      ok: readiness.teamCount > 0,
    },
    {
      label: "Jugadores en planteles",
      value: String(readiness.activePlayerCount),
      ok: readiness.activePlayerCount > 0,
    },
    {
      label: "Equipos con capitán",
      value: String(readiness.teamsWithCaptain),
      ok: readiness.teamsWithCaptain > 0,
    },
    ...(isLeague
      ? [
          {
            label: "Fixture generado",
            value: readiness.fixtureGenerated
              ? `Sí (${readiness.totalMatches})`
              : "No",
            ok: readiness.fixtureGenerated,
          },
          {
            label: "Partidos programados",
            value: `${readiness.scheduledMatches}/${readiness.totalMatches || 0}`,
            ok:
              readiness.fixtureGenerated &&
              readiness.pendingMatches === 0 &&
              readiness.totalMatches > 0,
          },
          {
            label: "Partidos pendientes",
            value: String(readiness.pendingMatches),
            ok: readiness.fixtureGenerated && readiness.pendingMatches === 0,
          },
        ]
      : []),
  ];
}

export function getSeasonReadinessStatus(
  season: Pick<SeasonDetail, "format_type" | "readiness">
): {
  complete: boolean;
  pendingLabels: string[];
  items: SeasonReadinessItem[];
} {
  const items = getSeasonReadinessItems(season);
  const pendingLabels = items.filter((item) => !item.ok).map((item) => item.label);
  return {
    complete: pendingLabels.length === 0,
    pendingLabels,
    items,
  };
}

export function seasonReadinessBlockedMessage(
  pendingLabels: string[]
): string {
  if (pendingLabels.length === 0) return "";
  return `Aún no se puede publicar. Falta: ${pendingLabels.join(", ")}.`;
}
