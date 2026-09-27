import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getTeamLogoPublicUrl } from "@/lib/teams/logo-url";

describe("public match detail official flag mapping", () => {
  const originalBase = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalBase;
    }
  });

  it("maps is_result_official from RPC row shape", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const row = {
      match_id: "match-1",
      home_team_name: "Home",
      away_team_name: "Away",
      home_team_logo_path: "org/home-team/logo.png",
      away_team_logo_path: null,
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
      homeTeamLogoUrl: getTeamLogoPublicUrl(row.home_team_logo_path),
      awayTeamLogoUrl: getTeamLogoPublicUrl(row.away_team_logo_path),
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
    assert.ok(mapped.homeTeamLogoUrl?.includes("team-logos"));
    assert.equal(mapped.awayTeamLogoUrl, null);
  });
});
