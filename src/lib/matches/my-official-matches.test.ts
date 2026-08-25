import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMyOfficialMatchAssignments } from "@/lib/matches/my-official-matches";

describe("buildMyOfficialMatchAssignments", () => {
  it("returns an empty list when the user has no match_officials rows", () => {
    const result = buildMyOfficialMatchAssignments(
      "org-1",
      [],
      [],
      new Map(),
      new Map()
    );
    assert.deepEqual(result, []);
  });

  it("sorts assignments by scheduled date ascending", () => {
    const result = buildMyOfficialMatchAssignments(
      "org-1",
      [
        { id: "mo-late", match_id: "m-late", role: "referee", status: "confirmed" },
        { id: "mo-early", match_id: "m-early", role: "delegate", status: "assigned" },
      ],
      [
        {
          id: "m-late",
          season_id: "s1",
          home_season_team_id: "h1",
          away_season_team_id: "a1",
          field_reservation_id: "r-late",
          season: {
            id: "s1",
            competition_id: "c1",
            visibility: "public",
            name: "Apertura",
            competitionName: "Liga",
          },
        },
        {
          id: "m-early",
          season_id: "s1",
          home_season_team_id: "h2",
          away_season_team_id: "a2",
          field_reservation_id: "r-early",
          season: {
            id: "s1",
            competition_id: "c1",
            visibility: "public",
            name: "Apertura",
            competitionName: "Liga",
          },
        },
      ],
      new Map([
        ["h1", "Halcones"],
        ["a1", "Titanes"],
        ["h2", "Leones"],
        ["a2", "Pumas"],
      ]),
      new Map([
        [
          "r-late",
          {
            id: "r-late",
            starts_at: "2026-08-20T20:00:00.000Z",
            fields: { name: "Cancha 1", venues: { name: "Centro" } },
          },
        ],
        [
          "r-early",
          {
            id: "r-early",
            starts_at: "2026-08-10T18:00:00.000Z",
            fields: { name: "Cancha 2", venues: { name: "Norte" } },
          },
        ],
      ])
    );

    assert.equal(result.length, 2);
    assert.equal(result[0]?.matchId, "m-early");
    assert.equal(result[0]?.matchOfficialId, "mo-early");
    assert.equal(result[1]?.matchId, "m-late");
    assert.match(result[0]?.captureHref ?? "", /\/captura$/);
  });

  it("excludes archived seasons", () => {
    const result = buildMyOfficialMatchAssignments(
      "org-1",
      [{ id: "mo-1", match_id: "m1", role: "referee", status: "confirmed" }],
      [
        {
          id: "m1",
          season_id: "s1",
          home_season_team_id: "h1",
          away_season_team_id: "a1",
          field_reservation_id: null,
          season: {
            id: "s1",
            competition_id: "c1",
            visibility: "archived",
            name: "Pasada",
            competitionName: "Liga",
          },
        },
      ],
      new Map([
        ["h1", "A"],
        ["a1", "B"],
      ]),
      new Map()
    );

    assert.deepEqual(result, []);
  });
});
