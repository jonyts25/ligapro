import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type FixtureTeam,
  fixtureToJsonPayload,
  generateRoundRobinFixture,
} from "./round-robin.ts";

function team(id: string, name = id): FixtureTeam {
  return { seasonTeamId: id, name };
}

function pairKey(homeId: string, awayId: string): string {
  return [homeId, awayId].sort().join("|");
}

function collectPairs(
  matches: ReturnType<typeof generateRoundRobinFixture>["matches"],
) {
  const pairs = new Map<string, Array<{ home: string; away: string }>>();

  for (const match of matches) {
    const key = pairKey(match.homeSeasonTeamId, match.awaySeasonTeamId);
    const existing = pairs.get(key) ?? [];
    existing.push({
      home: match.homeSeasonTeamId,
      away: match.awaySeasonTeamId,
    });
    pairs.set(key, existing);
  }

  return pairs;
}

describe("generateRoundRobinFixture", () => {
  it("generates a single-leg fixture for 2 teams", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b")],
      "single",
    );

    assert.equal(fixture.mode, "single");
    assert.equal(fixture.teamCount, 2);
    assert.equal(fixture.rounds.length, 1);
    assert.equal(fixture.matches.length, 1);
    assert.deepEqual(fixture.matches[0], {
      roundNumber: 1,
      legNumber: 1,
      homeSeasonTeamId: "a",
      awaySeasonTeamId: "b",
      sequenceInRound: 1,
    });
    assert.equal(fixture.rounds[0].byeSeasonTeamId, null);
  });

  it("generates a double-leg fixture for 2 teams", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b")],
      "double",
    );

    assert.equal(fixture.rounds.length, 2);
    assert.equal(fixture.matches.length, 2);
    assert.deepEqual(fixture.matches[0], {
      roundNumber: 1,
      legNumber: 1,
      homeSeasonTeamId: "a",
      awaySeasonTeamId: "b",
      sequenceInRound: 1,
    });
    assert.deepEqual(fixture.matches[1], {
      roundNumber: 2,
      legNumber: 2,
      homeSeasonTeamId: "b",
      awaySeasonTeamId: "a",
      sequenceInRound: 1,
    });
  });

  it("generates 3 single-leg rounds for 4 teams", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d")],
      "single",
    );

    assert.equal(fixture.rounds.length, 3);
    assert.equal(fixture.matches.length, 6);
    assert.equal(fixture.rounds.every((round) => round.byeSeasonTeamId === null), true);
    assert.equal(
      fixture.rounds.every((round) => round.matches.length === 2),
      true,
    );
  });

  it("generates a double-leg fixture for 4 teams", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d")],
      "double",
    );

    assert.equal(fixture.rounds.length, 6);
    assert.equal(fixture.matches.length, 12);
    assert.equal(fixture.rounds.filter((round) => round.legNumber === 1).length, 3);
    assert.equal(fixture.rounds.filter((round) => round.legNumber === 2).length, 3);
  });

  it("generates 5 single-leg rounds with byes for 5 teams", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d"), team("e")],
      "single",
    );

    assert.equal(fixture.rounds.length, 5);
    assert.equal(fixture.matches.length, 10);
    assert.equal(
      fixture.rounds.every((round) => round.matches.length === 2),
      true,
    );
    assert.equal(
      fixture.rounds.every((round) => round.byeSeasonTeamId !== null),
      true,
    );

    const byeTeams = fixture.rounds.map((round) => round.byeSeasonTeamId);
    assert.deepEqual(new Set(byeTeams), new Set(["a", "b", "c", "d", "e"]));
  });

  it("generates a double-leg fixture for 5 teams", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d"), team("e")],
      "double",
    );

    assert.equal(fixture.rounds.length, 10);
    assert.equal(fixture.matches.length, 20);
    assert.equal(fixture.rounds.filter((round) => round.legNumber === 1).length, 5);
    assert.equal(fixture.rounds.filter((round) => round.legNumber === 2).length, 5);
  });

  it("plays each pair exactly once in single mode", () => {
    const teams = [team("a"), team("b"), team("c"), team("d")];
    const fixture = generateRoundRobinFixture(teams, "single");
    const pairs = collectPairs(fixture.matches);

    assert.equal(pairs.size, 6);
    for (const occurrences of pairs.values()) {
      assert.equal(occurrences.length, 1);
    }
  });

  it("plays each pair exactly twice in double mode with inverted home/away", () => {
    const teams = [team("a"), team("b"), team("c"), team("d")];
    const fixture = generateRoundRobinFixture(teams, "double");
    const pairs = collectPairs(fixture.matches);

    assert.equal(pairs.size, 6);
    for (const occurrences of pairs.values()) {
      assert.equal(occurrences.length, 2);
      assert.notEqual(occurrences[0].home, occurrences[1].home);
      assert.equal(occurrences[0].home, occurrences[1].away);
      assert.equal(occurrences[0].away, occurrences[1].home);
    }
  });

  it("inverts home and away in leg 2", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d")],
      "double",
    );

    const firstLegMatches = fixture.matches.filter((match) => match.legNumber === 1);
    const secondLegMatches = fixture.matches.filter((match) => match.legNumber === 2);

    assert.equal(firstLegMatches.length, secondLegMatches.length);

    for (let index = 0; index < firstLegMatches.length; index++) {
      const firstLegMatch = firstLegMatches[index];
      const secondLegMatch = secondLegMatches[index];

      assert.equal(
        secondLegMatch.roundNumber,
        firstLegMatch.roundNumber + firstLegMatches.length / 2,
      );
      assert.equal(secondLegMatch.homeSeasonTeamId, firstLegMatch.awaySeasonTeamId);
      assert.equal(secondLegMatch.awaySeasonTeamId, firstLegMatch.homeSeasonTeamId);
      assert.equal(secondLegMatch.sequenceInRound, firstLegMatch.sequenceInRound);
    }
  });

  it("never schedules the same team twice in one round", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d"), team("e")],
      "double",
    );

    for (const round of fixture.rounds) {
      const teamIds = new Set<string>();
      if (round.byeSeasonTeamId) {
        teamIds.add(round.byeSeasonTeamId);
      }

      for (const match of round.matches) {
        assert.equal(teamIds.has(match.homeSeasonTeamId), false);
        assert.equal(teamIds.has(match.awaySeasonTeamId), false);
        teamIds.add(match.homeSeasonTeamId);
        teamIds.add(match.awaySeasonTeamId);
      }
    }
  });

  it("never schedules a team against itself", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d"), team("e")],
      "double",
    );

    for (const match of fixture.matches) {
      assert.notEqual(match.homeSeasonTeamId, match.awaySeasonTeamId);
    }
  });

  it("gives each odd-count team exactly one bye per leg", () => {
    const fixture = generateRoundRobinFixture(
      [team("a"), team("b"), team("c"), team("d"), team("e")],
      "double",
    );

    for (const legNumber of [1, 2] as const) {
      const legRounds = fixture.rounds.filter((round) => round.legNumber === legNumber);
      const byeCounts = new Map<string, number>();

      for (const round of legRounds) {
        assert.ok(round.byeSeasonTeamId);
        byeCounts.set(
          round.byeSeasonTeamId,
          (byeCounts.get(round.byeSeasonTeamId) ?? 0) + 1,
        );
      }

      assert.equal(byeCounts.size, 5);
      for (const count of byeCounts.values()) {
        assert.equal(count, 1);
      }
    }
  });

  it("is deterministic for the same input", () => {
    const teams = [team("a"), team("b"), team("c"), team("d"), team("e")];
    const first = generateRoundRobinFixture(teams, "double");
    const second = generateRoundRobinFixture(teams, "double");

    assert.deepEqual(first, second);
  });

  it("rejects duplicate seasonTeamId values", () => {
    assert.throws(
      () =>
        generateRoundRobinFixture(
          [team("a"), team("a"), team("b")],
          "single",
        ),
      /Duplicate seasonTeamId in fixture input: a/,
    );
  });

  it("rejects fewer than 2 teams", () => {
    assert.throws(
      () => generateRoundRobinFixture([team("a")], "single"),
      /Round-robin fixture requires at least 2 teams/,
    );
    assert.throws(
      () => generateRoundRobinFixture([], "single"),
      /Round-robin fixture requires at least 2 teams/,
    );
  });
});

describe("fixtureToJsonPayload", () => {
  it("maps generated matches to RPC-friendly plain objects", () => {
    const fixture = generateRoundRobinFixture([team("a"), team("b")], "single");

    assert.deepEqual(fixtureToJsonPayload(fixture.matches), [
      {
        round_number: 1,
        leg_number: 1,
        home_season_team_id: "a",
        away_season_team_id: "b",
        sequence_in_round: 1,
      },
    ]);
  });
});
