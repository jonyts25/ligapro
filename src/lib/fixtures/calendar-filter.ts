import type { FixtureRoundGroup } from "@/lib/fixtures/types";

export function parseSelectedRound(
  jornada: string | undefined
): number | "all" {
  if (jornada && /^\d+$/.test(jornada)) {
    return Number(jornada);
  }
  return "all";
}

export function filterFixtureRoundsByJornada(
  rounds: FixtureRoundGroup[],
  selectedRound: number | "all",
  filtro: "todas" | "pendientes" | "programadas" = "todas"
): FixtureRoundGroup[] {
  let filtered =
    selectedRound === "all"
      ? rounds
      : rounds.filter((round) => round.roundNumber === selectedRound);

  if (filtro === "todas") {
    return filtered;
  }

  return filtered.map((round) => ({
    ...round,
    matches: round.matches.filter((match) => {
      if (filtro === "pendientes") return !match.isProgrammed;
      return match.isProgrammed;
    }),
  }));
}
