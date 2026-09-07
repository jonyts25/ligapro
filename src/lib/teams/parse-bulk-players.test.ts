import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bulkPlayerEntriesForRpc,
  getDuplicateJerseyWarnings,
  hasDuplicateJerseyNumbers,
  parseBulkPlayerLines,
  parseBulkTeamNames,
} from "./parse-bulk-players.ts";

describe("parseBulkPlayerLines", () => {
  it("assigns auto jersey numbers in order when omitted", () => {
    const players = parseBulkPlayerLines("Juan Pérez, 10\nMaría López");
    assert.equal(players.length, 2);
    assert.equal(players[0]?.fullName, "Juan Pérez");
    assert.equal(players[0]?.finalJersey, 10);
    assert.equal(players[0]?.autoAssigned, false);
    assert.equal(players[1]?.fullName, "María López");
    assert.equal(players[1]?.finalJersey, 1);
    assert.equal(players[1]?.autoAssigned, true);
  });

  it("skips jersey numbers already taken by explicit assignments", () => {
    const players = parseBulkPlayerLines("Ana, 1\nBen\nCarlos, 3");
    assert.deepEqual(
      players.map((player) => player.finalJersey),
      [1, 2, 3]
    );
  });

  it("detects duplicate jersey numbers", () => {
    const players = parseBulkPlayerLines("Juan, 10\nAna Gómez, 10");
    assert.equal(hasDuplicateJerseyNumbers(players), true);
    const warnings = getDuplicateJerseyWarnings(players);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /Juan.*Ana Gómez.*10/);
  });
});

describe("bulkPlayerEntriesForRpc", () => {
  it("returns final jersey numbers for RPC submission", () => {
    const entries = bulkPlayerEntriesForRpc("Pedro, 7\nLucía");
    assert.deepEqual(entries, [
      { full_name: "Pedro", jersey_number: 7 },
      { full_name: "Lucía", jersey_number: 1 },
    ]);
  });
});

describe("parseBulkTeamNames", () => {
  it("parses one team name per line", () => {
    assert.deepEqual(parseBulkTeamNames("Halcones\nLeones\n"), [
      "Halcones",
      "Leones",
    ]);
  });
});
