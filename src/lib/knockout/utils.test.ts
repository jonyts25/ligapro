import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRoundAdvanceStatus,
  isTieTied,
  nextPowerOfTwo,
  resolveTieWinnerId,
} from "@/lib/knockout/utils";
import type { KnockoutTieRow } from "@/lib/knockout/types";

function tie(overrides: Partial<KnockoutTieRow> = {}): KnockoutTieRow {
  return {
    id: "t1",
    bracketSlot: 1,
    homeSeasonTeamId: "home",
    awaySeasonTeamId: "away",
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
    penaltyWinnerSeasonTeamId: null,
    matches: [
      {
        id: "m1",
        bracketSlot: 1,
        legNumber: 1,
        homeSeasonTeamId: "home",
        awaySeasonTeamId: "away",
        homeScore: 2,
        awayScore: 1,
        status: "finished",
      },
    ],
    ...overrides,
  };
}

describe("nextPowerOfTwo", () => {
  it("returns 2 for small inputs", () => {
    assert.equal(nextPowerOfTwo(1), 2);
    assert.equal(nextPowerOfTwo(2), 2);
  });

  it("rounds up to next power of 2", () => {
    assert.equal(nextPowerOfTwo(5), 8);
    assert.equal(nextPowerOfTwo(8), 8);
    assert.equal(nextPowerOfTwo(9), 16);
  });
});

describe("resolveTieWinnerId", () => {
  it("returns home on bye", () => {
    const t = tie({ awaySeasonTeamId: null, awayTeamName: null, matches: [] });
    assert.equal(resolveTieWinnerId(t, false), "home");
  });

  it("returns winner on single leg", () => {
    assert.equal(resolveTieWinnerId(tie(), false), "home");
  });

  it("returns penalty winner when tied single leg", () => {
    const t = tie({
      matches: [
        {
          id: "m1",
          bracketSlot: 1,
          legNumber: 1,
          homeSeasonTeamId: "home",
          awaySeasonTeamId: "away",
          homeScore: 1,
          awayScore: 1,
          status: "finished",
        },
      ],
      penaltyWinnerSeasonTeamId: "away",
    });
    assert.equal(resolveTieWinnerId(t, false), "away");
  });
});

describe("isTieTied", () => {
  it("is false when not finished", () => {
    const t = tie({
      matches: [
        {
          id: "m1",
          bracketSlot: 1,
          legNumber: 1,
          homeSeasonTeamId: "home",
          awaySeasonTeamId: "away",
          homeScore: null,
          awayScore: null,
          status: "scheduled",
        },
      ],
    });
    assert.equal(isTieTied(t, false), false);
  });

  it("is true on draw", () => {
    const t = tie({
      matches: [
        {
          id: "m1",
          bracketSlot: 1,
          legNumber: 1,
          homeSeasonTeamId: "home",
          awaySeasonTeamId: "away",
          homeScore: 0,
          awayScore: 0,
          status: "finished",
        },
      ],
    });
    assert.equal(isTieTied(t, false), true);
  });
});

describe("getRoundAdvanceStatus", () => {
  it("blocks advance when ties unresolved", () => {
    const status = getRoundAdvanceStatus(
      {
        roundNumber: 1,
        bracketSize: 4,
        isTwoLegs: false,
        ties: [
          tie(),
          tie({
            id: "t2",
            bracketSlot: 2,
            matches: [
              {
                id: "m2",
                bracketSlot: 2,
                legNumber: 1,
                homeSeasonTeamId: "h2",
                awaySeasonTeamId: "a2",
                homeScore: null,
                awayScore: null,
                status: "scheduled",
              },
            ],
          }),
        ],
      },
      2
    );
    assert.equal(status.canAdvance, false);
    assert.deepEqual(status.unresolvedSlots, [2]);
  });

  it("allows advance when all resolved and not final", () => {
    const status = getRoundAdvanceStatus(
      {
        roundNumber: 1,
        bracketSize: 4,
        isTwoLegs: false,
        ties: [tie(), tie({ id: "t2", bracketSlot: 2 })],
      },
      2
    );
    assert.equal(status.canAdvance, true);
  });
});
