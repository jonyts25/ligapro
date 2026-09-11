import {
  fixtureToJsonPayload,
  type FixtureMode,
  type GeneratedFixtureMatch,
} from "@/lib/fixtures/round-robin";
import { supportsAutoRoundRobin } from "@/lib/fixtures/types";

export const CATCH_UP_ROUND_LABEL = "Jornada de alcance";
export const CATCH_UP_RETURN_ROUND_LABEL = "Jornada de alcance (vuelta)";

export type CatchUpBlockReason =
  | "format_not_supported"
  | "knockout_phase_started"
  | "no_existing_fixture"
  | "no_opponents"
  | "already_has_matches"
  | "catch_up_already_exists";

export type CatchUpEligibilityInput = {
  formatType: string;
  knockoutPhaseStarted: boolean;
  existingLeagueMatchCount: number;
  newTeamMatchCount: number;
  opponentSeasonTeamIds: string[];
};

export type CatchUpEligibility = {
  eligible: boolean;
  reason?: CatchUpBlockReason;
  message?: string;
};

export type LeagueMatchMeta = {
  leg_number: number | null;
  round_number: number | null;
  round_label: string | null;
  status: string;
  home_season_team_id: string;
  away_season_team_id: string;
};

export function inferSeasonFixtureMode(
  formatType: string,
  leagueMatches: Array<{ leg_number: number | null }>
): FixtureMode | null {
  if (formatType === "round_robin_double") return "double";
  if (formatType === "round_robin") return "single";
  if (leagueMatches.length === 0) return null;
  return leagueMatches.some((match) => match.leg_number === 2) ? "double" : "single";
}

export function maxLeagueRoundNumber(
  leagueMatches: Array<{ round_number: number | null }>
): number {
  return leagueMatches.reduce(
    (max, match) => Math.max(max, match.round_number ?? 0),
    0
  );
}

export function catchUpRoundNumbers(
  mode: FixtureMode,
  maxExistingRound: number
): { firstLeg: number; secondLeg?: number } {
  const firstLeg = maxExistingRound + 1;
  if (mode === "double") {
    return { firstLeg, secondLeg: maxExistingRound + 2 };
  }
  return { firstLeg };
}

export function generateCatchUpFixtureMatches(input: {
  newSeasonTeamId: string;
  opponentSeasonTeamIds: string[];
  mode: FixtureMode;
  catchUpRoundNumber: number;
}): GeneratedFixtureMatch[] {
  const { newSeasonTeamId, opponentSeasonTeamIds, mode, catchUpRoundNumber } =
    input;

  const matches: GeneratedFixtureMatch[] = [];
  let sequence = 1;

  for (const opponentId of opponentSeasonTeamIds) {
    matches.push({
      roundNumber: catchUpRoundNumber,
      legNumber: 1,
      homeSeasonTeamId: newSeasonTeamId,
      awaySeasonTeamId: opponentId,
      sequenceInRound: sequence,
    });
    sequence += 1;
  }

  if (mode === "double") {
    const returnRound = catchUpRoundNumber + 1;
    let returnSequence = 1;
    for (const opponentId of opponentSeasonTeamIds) {
      matches.push({
        roundNumber: returnRound,
        legNumber: 2,
        homeSeasonTeamId: opponentId,
        awaySeasonTeamId: newSeasonTeamId,
        sequenceInRound: returnSequence,
      });
      returnSequence += 1;
    }
  }

  return matches;
}

export function evaluateCatchUpEligibility(
  input: CatchUpEligibilityInput
): CatchUpEligibility {
  if (input.formatType === "groups_knockout" && input.knockoutPhaseStarted) {
    return {
      eligible: false,
      reason: "knockout_phase_started",
      message:
        "No se pueden agregar equipos con partidos de alcance: la fase de eliminación ya inició.",
    };
  }

  if (!supportsAutoRoundRobin(input.formatType)) {
    return {
      eligible: false,
      reason: "format_not_supported",
      message:
        "Los partidos de alcance solo están disponibles en torneos todos contra todos.",
    };
  }

  if (input.existingLeagueMatchCount === 0) {
    return {
      eligible: false,
      reason: "no_existing_fixture",
      message: "Aún no hay fixture en este torneo.",
    };
  }

  if (input.newTeamMatchCount > 0) {
    return {
      eligible: false,
      reason: input.newTeamMatchCount > 0 ? "already_has_matches" : "catch_up_already_exists",
      message:
        "Este equipo ya tiene partidos en el torneo. No se pueden generar partidos de alcance de nuevo.",
    };
  }

  if (input.opponentSeasonTeamIds.length === 0) {
    return {
      eligible: false,
      reason: "no_opponents",
      message: "No hay otros equipos inscritos para emparejar.",
    };
  }

  return { eligible: true };
}

export function buildCatchUpFixturePayload(input: {
  newSeasonTeamId: string;
  opponentSeasonTeamIds: string[];
  mode: FixtureMode;
  maxExistingRound: number;
}) {
  const rounds = catchUpRoundNumbers(input.mode, input.maxExistingRound);
  const matches = generateCatchUpFixtureMatches({
    newSeasonTeamId: input.newSeasonTeamId,
    opponentSeasonTeamIds: input.opponentSeasonTeamIds,
    mode: input.mode,
    catchUpRoundNumber: rounds.firstLeg,
  });

  return {
    mode: input.mode,
    roundNumbers: rounds,
    matches,
    payload: fixtureToJsonPayload(matches),
  };
}

export function catchUpBlockMessageForEnrollment(
  formatType: string,
  knockoutPhaseStarted: boolean
): string | null {
  if (formatType === "groups_knockout" && knockoutPhaseStarted) {
    return "No se pueden inscribir equipos nuevos: la fase de eliminación ya inició.";
  }
  return null;
}
