import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { estimateTournamentPlan } from "./simulator";

describe("estimateTournamentPlan", () => {
  it("returns null when teamCount < 2 or fieldsCount is 0", () => {
    assert.equal(
      estimateTournamentPlan({
        teamCount: 1,
        formatType: "round_robin",
        fieldsCount: 2,
      }),
      null
    );
    assert.equal(
      estimateTournamentPlan({
        teamCount: 8,
        formatType: "round_robin",
        fieldsCount: 0,
      }),
      null
    );
  });

  it("round_robin: n×(n−1)/2", () => {
    const eightTeams = estimateTournamentPlan({
      teamCount: 8,
      formatType: "round_robin",
      fieldsCount: 2,
    });
    assert.deepEqual(eightTeams, {
      totalMatches: 28,
      matchesPerWeek: 2,
      estimatedWeeks: 14,
      formula: "8×(8−1)/2 = 28 partidos (todos contra todos, una vuelta)",
      isApproximate: false,
    });

    const twoTeams = estimateTournamentPlan({
      teamCount: 2,
      formatType: "round_robin",
      fieldsCount: 1,
    });
    assert.equal(twoTeams?.totalMatches, 1);
    assert.equal(twoTeams?.estimatedWeeks, 1);
  });

  it("round_robin_double: n×(n−1)", () => {
    const result = estimateTournamentPlan({
      teamCount: 5,
      formatType: "round_robin_double",
      fieldsCount: 3,
    });
    assert.equal(result?.totalMatches, 20);
    assert.equal(result?.matchesPerWeek, 3);
    assert.equal(result?.estimatedWeeks, 7);
    assert.equal(result?.isApproximate, false);
  });

  it("knockout: n−1 and +1 third place when n ≥ 4", () => {
    const small = estimateTournamentPlan({
      teamCount: 2,
      formatType: "knockout",
      fieldsCount: 1,
    });
    assert.equal(small?.totalMatches, 1);

    const withThird = estimateTournamentPlan({
      teamCount: 8,
      formatType: "knockout",
      fieldsCount: 2,
    });
    assert.equal(withThird?.totalMatches, 8);
    assert.equal(withThird?.estimatedWeeks, 4);
  });

  it("groups_knockout: approximate with default advance 2", () => {
    const result = estimateTournamentPlan({
      teamCount: 8,
      formatType: "groups_knockout",
      fieldsCount: 2,
    });
    assert.equal(result?.isApproximate, true);
    assert.equal(result?.totalMatches, 16);
    assert.equal(result?.estimatedWeeks, 8);
    assert.match(result?.formula ?? "", /estimado/);
  });

  it("groups_knockout: odd team count rounds groups up", () => {
    const result = estimateTournamentPlan({
      teamCount: 9,
      formatType: "groups_knockout",
      fieldsCount: 2,
      groupsAdvancePerGroup: 2,
    });
    assert.equal(result?.totalMatches, 24);
  });

  it("groups_knockout: respects custom groupsAdvancePerGroup", () => {
    const result = estimateTournamentPlan({
      teamCount: 8,
      formatType: "groups_knockout",
      fieldsCount: 2,
      groupsAdvancePerGroup: 1,
    });
    assert.equal(result?.totalMatches, 13);
  });
});
