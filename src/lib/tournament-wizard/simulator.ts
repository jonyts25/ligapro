import type { SeasonFormatType } from "@/lib/competitions/types";

export type EstimateTournamentPlanInput = {
  teamCount: number;
  formatType: SeasonFormatType;
  /** Canchas con horario configurado en el paso «horarios». */
  fieldsCount: number;
  groupsAdvancePerGroup?: number | null;
};

export type EstimateTournamentPlanResult = {
  totalMatches: number;
  matchesPerWeek: number;
  estimatedWeeks: number;
  formula: string;
  isApproximate: boolean;
};

function roundRobinMatches(teamCount: number): number {
  return (teamCount * (teamCount - 1)) / 2;
}

function knockoutMatches(teamCount: number): number {
  // Eliminación directa a partido único: n−1 rondas.
  // Partido por 3.er lugar (+1) cuando hay al menos 4 equipos en la llave.
  let total = teamCount - 1;
  if (teamCount >= 4) {
    total += 1;
  }
  return total;
}

/**
 * groups_knockout (aproximado):
 * - ceil(n/4) grupos de 4 equipos
 * - Fase de grupos: cada grupo juega todos contra todos (6 partidos/grupo)
 * - Llaves: grupos × advancePerGroup clasificados; eliminación directa (+3.er si ≥4)
 */
function groupsKnockoutMatches(
  teamCount: number,
  groupsAdvancePerGroup: number
): { total: number; formula: string } {
  const groupSize = 4;
  const groupCount = Math.ceil(teamCount / groupSize);
  const groupStageMatches = groupCount * roundRobinMatches(groupSize);
  const knockoutTeams = groupCount * groupsAdvancePerGroup;
  const knockoutStageMatches = knockoutMatches(knockoutTeams);
  const total = groupStageMatches + knockoutStageMatches;

  const thirdPlaceNote =
    knockoutTeams >= 4 ? " + partido por 3.er lugar" : "";

  return {
    total,
    formula: `~${groupCount} grupos × 6 partidos + llave de ${knockoutTeams} equipos (${knockoutTeams - 1}${thirdPlaceNote})`,
  };
}

export function estimateTournamentPlan(
  input: EstimateTournamentPlanInput
): EstimateTournamentPlanResult | null {
  const { teamCount, formatType, fieldsCount, groupsAdvancePerGroup } = input;

  if (teamCount < 2 || fieldsCount === 0) {
    return null;
  }

  let totalMatches: number;
  let formula: string;
  let isApproximate = false;

  switch (formatType) {
    case "round_robin":
      totalMatches = roundRobinMatches(teamCount);
      formula = `${teamCount}×(${teamCount}−1)/2 = ${totalMatches} partidos (todos contra todos, una vuelta)`;
      break;
    case "round_robin_double":
      totalMatches = teamCount * (teamCount - 1);
      formula = `${teamCount}×(${teamCount}−1) = ${totalMatches} partidos (ida y vuelta)`;
      break;
    case "knockout":
      totalMatches = knockoutMatches(teamCount);
      formula =
        teamCount >= 4
          ? `${teamCount}−1 + partido por 3.er lugar = ${totalMatches} partidos (eliminación directa)`
          : `${teamCount}−1 = ${totalMatches} partidos (eliminación directa)`;
      break;
    case "groups_knockout": {
      isApproximate = true;
      const advance = groupsAdvancePerGroup ?? 2;
      const estimate = groupsKnockoutMatches(teamCount, advance);
      totalMatches = estimate.total;
      formula = `${estimate.formula} — estimado con grupos de 4 y ${advance} clasificados por grupo`;
      break;
    }
    default:
      return null;
  }

  const matchesPerWeek = fieldsCount;
  const estimatedWeeks = Math.ceil(totalMatches / matchesPerWeek);

  return {
    totalMatches,
    matchesPerWeek,
    estimatedWeeks,
    formula,
    isApproximate,
  };
}
