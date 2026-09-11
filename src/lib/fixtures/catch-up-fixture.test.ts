import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCatchUpFixturePayload,
  catchUpRoundNumbers,
  evaluateCatchUpEligibility,
  generateCatchUpFixtureMatches,
  inferSeasonFixtureMode,
  maxLeagueRoundNumber,
} from "@/lib/fixtures/catch-up-fixture";

describe("generateCatchUpFixtureMatches", () => {
  it("creates one leg-1 match against each existing team in single mode", () => {
    const matches = generateCatchUpFixtureMatches({
      newSeasonTeamId: "team-new",
      opponentSeasonTeamIds: ["team-a", "team-b", "team-c"],
      mode: "single",
      catchUpRoundNumber: 8,
    });

    assert.equal(matches.length, 3);
    assert.deepEqual(
      matches.map((match) => ({
        round: match.roundNumber,
        leg: match.legNumber,
        home: match.homeSeasonTeamId,
        away: match.awaySeasonTeamId,
      })),
      [
        { round: 8, leg: 1, home: "team-new", away: "team-a" },
        { round: 8, leg: 1, home: "team-new", away: "team-b" },
        { round: 8, leg: 1, home: "team-new", away: "team-c" },
      ]
    );
  });

  it("creates home and away legs when the original fixture was double", () => {
    const matches = generateCatchUpFixtureMatches({
      newSeasonTeamId: "team-new",
      opponentSeasonTeamIds: ["team-a", "team-b"],
      mode: "double",
      catchUpRoundNumber: 10,
    });

    assert.equal(matches.length, 4);
    assert.deepEqual(
      matches.map((match) => ({
        round: match.roundNumber,
        leg: match.legNumber,
        home: match.homeSeasonTeamId,
        away: match.awaySeasonTeamId,
      })),
      [
        { round: 10, leg: 1, home: "team-new", away: "team-a" },
        { round: 10, leg: 1, home: "team-new", away: "team-b" },
        { round: 11, leg: 2, home: "team-a", away: "team-new" },
        { round: 11, leg: 2, home: "team-b", away: "team-new" },
      ]
    );
  });
});

describe("catchUpRoundNumbers", () => {
  it("uses the next round after the current maximum", () => {
    assert.deepEqual(catchUpRoundNumbers("single", 7), { firstLeg: 8 });
    assert.deepEqual(catchUpRoundNumbers("double", 7), {
      firstLeg: 8,
      secondLeg: 9,
    });
  });
});

describe("maxLeagueRoundNumber", () => {
  it("returns the highest existing round number", () => {
    assert.equal(
      maxLeagueRoundNumber([
        { round_number: 3 },
        { round_number: 7 },
        { round_number: 5 },
      ]),
      7
    );
  });
});

describe("inferSeasonFixtureMode", () => {
  it("prefers format_type but can infer double from existing legs", () => {
    assert.equal(inferSeasonFixtureMode("round_robin", []), "single");
    assert.equal(inferSeasonFixtureMode("round_robin_double", []), "double");
    assert.equal(
      inferSeasonFixtureMode("groups_knockout", [{ leg_number: 2 }]),
      "double"
    );
  });
});

describe("evaluateCatchUpEligibility", () => {
  it("allows catch-up for round-robin seasons with existing fixture", () => {
    const result = evaluateCatchUpEligibility({
      formatType: "round_robin",
      knockoutPhaseStarted: false,
      existingLeagueMatchCount: 12,
      newTeamMatchCount: 0,
      opponentSeasonTeamIds: ["a", "b"],
    });
    assert.equal(result.eligible, true);
  });

  it("blocks unsupported formats", () => {
    const result = evaluateCatchUpEligibility({
      formatType: "knockout",
      knockoutPhaseStarted: false,
      existingLeagueMatchCount: 4,
      newTeamMatchCount: 0,
      opponentSeasonTeamIds: ["a"],
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "format_not_supported");
  });

  it("blocks when knockout phase already started in groups format", () => {
    const result = evaluateCatchUpEligibility({
      formatType: "groups_knockout",
      knockoutPhaseStarted: true,
      existingLeagueMatchCount: 20,
      newTeamMatchCount: 0,
      opponentSeasonTeamIds: ["a", "b"],
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "knockout_phase_started");
  });

  it("blocks when the new team already has matches", () => {
    const result = evaluateCatchUpEligibility({
      formatType: "round_robin",
      knockoutPhaseStarted: false,
      existingLeagueMatchCount: 12,
      newTeamMatchCount: 2,
      opponentSeasonTeamIds: ["a", "b"],
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "already_has_matches");
  });
});

describe("buildCatchUpFixturePayload", () => {
  it("does not reuse existing round numbers", () => {
    const built = buildCatchUpFixturePayload({
      newSeasonTeamId: "team-new",
      opponentSeasonTeamIds: ["team-a"],
      mode: "single",
      maxExistingRound: 6,
    });

    assert.equal(built.roundNumbers.firstLeg, 7);
    assert.equal(built.matches[0]?.roundNumber, 7);
    assert.equal(built.payload.length, 1);
  });
});
