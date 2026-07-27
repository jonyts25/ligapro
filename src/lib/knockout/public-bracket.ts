import type { PublicMatchRow } from "@/lib/public-season/types";
import type {
  KnockoutBracketData,
  KnockoutMatchRow,
  KnockoutRoundRow,
  KnockoutTieRow,
} from "@/lib/knockout/types";
import { resolveTieWinnerId } from "@/lib/knockout/utils";

/**
 * Builds read-only bracket data from public match rows (no ties/byes/penalties RPC).
 */
export function buildPublicKnockoutBracket(
  matches: PublicMatchRow[]
): KnockoutBracketData {
  const knockoutMatches = matches.filter(
    (m) => m.knockoutRoundNumber != null && m.bracketSlot != null
  );

  if (!knockoutMatches.length) {
    return {
      rounds: [],
      championSeasonTeamId: null,
      championTeamName: null,
      teamNames: {},
    };
  }

  const roundMap = new Map<
    number,
    {
      roundLabel: string;
      ties: Map<number, KnockoutTieRow>;
    }
  >();

  for (const m of knockoutMatches) {
    const roundNum = m.knockoutRoundNumber!;
    const slot = m.bracketSlot!;
    if (!roundMap.has(roundNum)) {
      roundMap.set(roundNum, {
        roundLabel: m.roundLabel ?? `Ronda ${roundNum}`,
        ties: new Map(),
      });
    }
    const round = roundMap.get(roundNum)!;
    if (!round.ties.has(slot)) {
      const homeId = `name:${m.homeTeamName}`;
      const awayId = `name:${m.awayTeamName}`;
      round.ties.set(slot, {
        id: `${roundNum}-${slot}`,
        bracketSlot: slot,
        homeSeasonTeamId: homeId,
        awaySeasonTeamId: awayId,
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        penaltyWinnerSeasonTeamId: null,
        matches: [],
      });
    }
    const tie = round.ties.get(slot)!;
    const matchRow: KnockoutMatchRow = {
      id: `${roundNum}-${slot}-${m.legNumber ?? 1}`,
      bracketSlot: slot,
      legNumber: m.legNumber ?? 1,
      homeSeasonTeamId: tie.homeSeasonTeamId,
      awaySeasonTeamId: tie.awaySeasonTeamId ?? `name:${m.awayTeamName}`,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
    };
    tie.matches.push(matchRow);
  }

  const rounds: KnockoutRoundRow[] = [...roundMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([roundNumber, { roundLabel, ties }]) => {
      const tieList = [...ties.values()].sort(
        (a, b) => a.bracketSlot - b.bracketSlot
      );
      const maxSlot = Math.max(...tieList.map((t) => t.bracketSlot), 1);
      const isTwoLegs = tieList.some((t) =>
        t.matches.some((m) => m.legNumber === 2)
      );
      return {
        id: `round-${roundNumber}`,
        roundNumber,
        roundLabel,
        bracketSize: maxSlot * 2,
        isTwoLegs,
        ties: tieList,
      };
    });

  const maxRound = Math.max(...rounds.map((r) => r.roundNumber));
  const finalRound = rounds.find((r) => r.roundNumber === maxRound);
  let championTeamName: string | null = null;
  if (finalRound?.ties.length === 1) {
    const tie = finalRound.ties[0];
    const winnerId = resolveTieWinnerId(tie, finalRound.isTwoLegs);
    if (winnerId === tie.homeSeasonTeamId) championTeamName = tie.homeTeamName;
    else if (winnerId === tie.awaySeasonTeamId)
      championTeamName = tie.awayTeamName ?? null;
  }

  return {
    rounds,
    championSeasonTeamId: null,
    championTeamName,
    teamNames: {},
  };
}
