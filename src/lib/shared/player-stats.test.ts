import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapPlayerStatsRows,
  sumPlayerStatsTotals,
  type PlayerStatsRow,
} from "./player-stats";

describe("player-stats", () => {
  it("mapPlayerStatsRows maps RPC snake_case to camelCase", () => {
    const rows = mapPlayerStatsRows([
      {
        season_team_player_id: "stp-1",
        matches_played: 3,
        goals: 2,
        assists: 1,
        own_goals: 0,
        yellow_cards: 1,
        red_cards: 0,
      },
    ]);

    assert.deepEqual(rows[0], {
      seasonTeamPlayerId: "stp-1",
      matchesPlayed: 3,
      goals: 2,
      assists: 1,
      ownGoals: 0,
      yellowCards: 1,
      redCards: 0,
    });
  });

  it("sumPlayerStatsTotals sums all teams for profile totals card", () => {
    const perTeam: PlayerStatsRow[] = [
      {
        seasonTeamPlayerId: "stp-a",
        matchesPlayed: 5,
        goals: 3,
        assists: 2,
        ownGoals: 0,
        yellowCards: 1,
        redCards: 0,
      },
      {
        seasonTeamPlayerId: "stp-b",
        matchesPlayed: 2,
        goals: 1,
        assists: 0,
        ownGoals: 1,
        yellowCards: 0,
        redCards: 1,
      },
    ];

    assert.deepEqual(sumPlayerStatsTotals(perTeam), {
      matchesPlayed: 7,
      goals: 4,
      assists: 2,
      ownGoals: 1,
      yellowCards: 1,
      redCards: 1,
    });
  });

  it("sumPlayerStatsTotals returns zeros for empty input", () => {
    assert.deepEqual(sumPlayerStatsTotals([]), {
      matchesPlayed: 0,
      goals: 0,
      assists: 0,
      ownGoals: 0,
      yellowCards: 0,
      redCards: 0,
    });
  });
});
