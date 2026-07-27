import type { KnockoutMatchRow, KnockoutTieRow } from "@/lib/knockout/types";

export function nextPowerOfTwo(n: number): number {
  if (n < 2) return 2;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function isOfficialMatch(m: KnockoutMatchRow): boolean {
  return (
    (m.status === "finished" || m.status === "walkover") &&
    m.homeScore != null &&
    m.awayScore != null
  );
}

export function tieHasStartedPlay(tie: KnockoutTieRow): boolean {
  return tie.matches.some((m) => m.status !== "scheduled");
}

export function resolveTieWinnerId(
  tie: KnockoutTieRow,
  isTwoLegs: boolean
): string | null {
  if (tie.awaySeasonTeamId == null) {
    return tie.homeSeasonTeamId;
  }

  const legs = [...tie.matches].sort((a, b) => a.legNumber - b.legNumber);

  if (!isTwoLegs) {
    const leg = legs[0];
    if (!leg || !isOfficialMatch(leg)) return null;
    if (leg.homeScore! > leg.awayScore!) return tie.homeSeasonTeamId;
    if (leg.awayScore! > leg.homeScore!) return tie.awaySeasonTeamId;
    return tie.penaltyWinnerSeasonTeamId;
  }

  const leg1 = legs.find((m) => m.legNumber === 1);
  const leg2 = legs.find((m) => m.legNumber === 2);
  if (!leg1 || !leg2 || !isOfficialMatch(leg1) || !isOfficialMatch(leg2)) {
    return null;
  }

  const homeGoals = leg1.homeScore! + leg2.awayScore!;
  const awayGoals = leg1.awayScore! + leg2.homeScore!;
  if (homeGoals > awayGoals) return tie.homeSeasonTeamId;
  if (awayGoals > homeGoals) return tie.awaySeasonTeamId;
  return tie.penaltyWinnerSeasonTeamId;
}

export function isTieTied(tie: KnockoutTieRow, isTwoLegs: boolean): boolean {
  if (tie.awaySeasonTeamId == null) return false;
  const legs = [...tie.matches].sort((a, b) => a.legNumber - b.legNumber);

  if (!isTwoLegs) {
    const leg = legs[0];
    if (!leg || !isOfficialMatch(leg)) return false;
    return leg.homeScore === leg.awayScore;
  }

  const leg1 = legs.find((m) => m.legNumber === 1);
  const leg2 = legs.find((m) => m.legNumber === 2);
  if (!leg1 || !leg2 || !isOfficialMatch(leg1) || !isOfficialMatch(leg2)) {
    return false;
  }
  const homeGoals = leg1.homeScore! + leg2.awayScore!;
  const awayGoals = leg1.awayScore! + leg2.homeScore!;
  return homeGoals === awayGoals;
}

export function formatTieScore(
  tie: KnockoutTieRow,
  isTwoLegs: boolean
): string | null {
  if (tie.awaySeasonTeamId == null) return "Bye";

  const legs = [...tie.matches].sort((a, b) => a.legNumber - b.legNumber);
  if (!legs.length) return null;

  if (!isTwoLegs) {
    const leg = legs[0];
    if (!leg || leg.homeScore == null || leg.awayScore == null) return null;
    return `${leg.homeScore}–${leg.awayScore}`;
  }

  const leg1 = legs.find((m) => m.legNumber === 1);
  const leg2 = legs.find((m) => m.legNumber === 2);
  if (!leg1 || leg1.homeScore == null || leg1.awayScore == null) return null;
  if (!leg2 || leg2.homeScore == null || leg2.awayScore == null) {
    return `Ida ${leg1.homeScore}–${leg1.awayScore}`;
  }
  const aggHome = leg1.homeScore + leg2.awayScore;
  const aggAway = leg1.awayScore + leg2.homeScore;
  return `${aggHome}–${aggAway} (agg)`;
}

export type RoundAdvanceStatus = {
  canAdvance: boolean;
  unresolvedSlots: number[];
  isFinalRound: boolean;
};

export function getRoundAdvanceStatus(
  round: { roundNumber: number; bracketSize: number; isTwoLegs: boolean; ties: KnockoutTieRow[] },
  maxRoundNumber: number
): RoundAdvanceStatus {
  const unresolvedSlots: number[] = [];
  for (const tie of round.ties) {
    if (!resolveTieWinnerId(tie, round.isTwoLegs)) {
      unresolvedSlots.push(tie.bracketSlot);
    }
  }
  const isFinalRound = round.roundNumber === maxRoundNumber && round.ties.length === 1;
  return {
    canAdvance: unresolvedSlots.length === 0 && !isFinalRound,
    unresolvedSlots,
    isFinalRound,
  };
}
