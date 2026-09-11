import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRosterImportInsertRows,
  buildRosterImportOverCapacityWarning,
  formatRosterImportSourceLabel,
  selectActivePlayersForImport,
} from "@/lib/teams/roster-import";

describe("selectActivePlayersForImport", () => {
  it("copies only active players with names and jersey numbers", () => {
    const source = [
      {
        playerId: "p1",
        fullName: "Ana López",
        jerseyNumber: 10,
        registrationStatus: "active",
      },
      {
        playerId: "p2",
        fullName: "Bruno Ruiz",
        jerseyNumber: 7,
        registrationStatus: "inactive",
      },
      {
        playerId: "p3",
        fullName: "Carlos Díaz",
        jerseyNumber: null,
        registrationStatus: "active",
      },
    ];

    const imported = selectActivePlayersForImport(source);

    assert.deepEqual(imported, [
      { playerId: "p1", fullName: "Ana López", jerseyNumber: 10 },
      { playerId: "p3", fullName: "Carlos Díaz", jerseyNumber: null },
    ]);
    assert.deepEqual(source[0], {
      playerId: "p1",
      fullName: "Ana López",
      jerseyNumber: 10,
      registrationStatus: "active",
    });
  });
});

describe("buildRosterImportInsertRows", () => {
  it("creates new roster rows without captain flags or source mutations", () => {
    const activePlayers = [
      { playerId: "p1", fullName: "Ana López", jerseyNumber: 10 },
      { playerId: "p2", fullName: "Bruno Ruiz", jerseyNumber: 8 },
    ];

    const rows = buildRosterImportInsertRows(activePlayers);

    assert.deepEqual(rows, [
      { playerId: "p1", jerseyNumber: 10, registrationStatus: "active" },
      { playerId: "p2", jerseyNumber: 8, registrationStatus: "active" },
    ]);
    assert.deepEqual(activePlayers, [
      { playerId: "p1", fullName: "Ana López", jerseyNumber: 10 },
      { playerId: "p2", fullName: "Bruno Ruiz", jerseyNumber: 8 },
    ]);
  });
});

describe("buildRosterImportOverCapacityWarning", () => {
  it("returns null when import fits max roster size", () => {
    assert.equal(buildRosterImportOverCapacityWarning(12, 15), null);
    assert.equal(buildRosterImportOverCapacityWarning(20, null), null);
  });

  it("returns a warning when import exceeds max roster size", () => {
    const warning = buildRosterImportOverCapacityWarning(18, 15);
    assert.ok(warning);
    assert.match(warning, /18 jugadores activos/);
    assert.match(warning, /máximo permitido es 15/);
  });
});

describe("formatRosterImportSourceLabel", () => {
  it("uses competition name and season start date when available", () => {
    const label = formatRosterImportSourceLabel({
      competitionName: "Liga Primavera",
      seasonStartsOn: "2025-03-01",
      seasonCreatedAt: "2025-01-10T00:00:00.000Z",
    });

    assert.match(label, /Liga Primavera/);
    assert.match(label, /2025/);
  });
});
