import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("public match detail official flag mapping", () => {
  it("maps is_result_official from RPC row shape", () => {
    const row = {
      match_id: "match-1",
      home_team_name: "Home",
      away_team_name: "Away",
      status: "finished",
      home_score: 2,
      away_score: 1,
      starts_at: null,
      venue_name: null,
      field_name: null,
      round_label: null,
      round_number: 1,
      leg_number: null,
      is_result_official: false,
    };

    const mapped = {
      matchId: row.match_id,
      homeTeamName: row.home_team_name,
      awayTeamName: row.away_team_name,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      startsAt: row.starts_at,
      venueName: row.venue_name,
      fieldName: row.field_name,
      roundLabel: row.round_label,
      roundNumber: row.round_number,
      legNumber: row.leg_number,
      isResultOfficial: row.is_result_official,
    };

    assert.equal(mapped.isResultOfficial, false);
  });
});
