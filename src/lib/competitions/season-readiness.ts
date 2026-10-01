import type { SeasonDetail } from "@/lib/competitions/types";

export type SeasonReadinessLevel = "required" | "recommended";

export type SeasonReadinessItem = {
  label: string;
  value: string;
  ok: boolean;
  level: SeasonReadinessLevel;
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
      label: "Canchas activas",
      value: String(readiness.effectiveActiveFields),
      ok: readiness.effectiveActiveFields > 0,
      level: "required",
    },
    {
      label: "Equipos inscritos",
      value: String(readiness.teamCount),
      ok: isLeague ? readiness.teamCount >= 2 : readiness.teamCount > 0,
      level: "required",
    },
    {
      label: "Jugadores en planteles",
      value: String(readiness.activePlayerCount),
      ok: readiness.activePlayerCount > 0,
      level: "required",
    },
    {
      label: "Equipos con capitán",
      value: `${readiness.teamsWithCaptain}/${readiness.teamCount}`,
      ok:
        readiness.teamCount > 0 &&
        readiness.teamsWithCaptain >= readiness.teamCount,
      level: "recommended",
    },
    ...(isLeague
      ? [
          {
            label: "Fixture generado",
            value: readiness.fixtureGenerated
              ? `Sí (${readiness.totalMatches})`
              : "No",
            ok: readiness.fixtureGenerated,
            level: "required" as const,
          },
          {
            label: "Partidos programados",
            value: `${readiness.scheduledMatches}/${readiness.totalMatches || 0}`,
            ok:
              readiness.fixtureGenerated &&
              readiness.pendingMatches === 0 &&
              readiness.totalMatches > 0,
            level: "required" as const,
          },
          {
            label: "Partidos pendientes",
            value: String(readiness.pendingMatches),
            ok: readiness.fixtureGenerated && readiness.pendingMatches === 0,
            level: "required" as const,
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
  const pendingLabels = items
    .filter((item) => item.level === "required" && !item.ok)
    .map((item) => item.label);
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
