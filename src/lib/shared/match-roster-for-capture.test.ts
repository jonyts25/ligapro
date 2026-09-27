import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  buildMatchRosterForCapture,
  type MatchParticipationStatus,
} from "./match-roster-for-capture";

describe("buildMatchRosterForCapture", () => {
  const originalBase = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalBase;
    }
  });

  it("maps team names, logos and participation status", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    const participation = new Map<string, MatchParticipationStatus>([
      ["stp-home-1", "played"],
    ]);

    const result = buildMatchRosterForCapture({
      match: {
        id: "match-1",
        organization_id: "org-1",
        season_id: "season-1",
        status: "scheduled",
        home_season_team_id: "st-home",
        away_season_team_id: "st-away",
      },
      matchDurationMinutes: 90,
      seasonTeams: [
        {
          id: "st-home",
          display_name: null,
          teams: { name: "Halcones", logo_path: "org/team/logo.png" },
        },
        {
          id: "st-away",
          display_name: "Visitantes FC",
          teams: { name: "Leones", logo_path: null },
        },
      ],
      roster: [
        {
          id: "stp-home-1",
          season_team_id: "st-home",
          jersey_number: 10,
          players: { full_name: "Ana Pérez" },
        },
        {
          id: "stp-away-1",
          season_team_id: "st-away",
          jersey_number: 7,
          players: { full_name: "Luis Gómez" },
        },
      ],
      participationByPlayer: participation,
    });

    assert.equal(result.halfDurationMinutes, 45);
    assert.equal(result.homeTeamName, "Halcones");
    assert.equal(result.awayTeamName, "Visitantes FC");
    assert.ok(result.homeTeamLogoUrl?.includes("team-logos"));
    assert.equal(result.awayTeamLogoUrl, null);
    assert.equal(result.homePlayers[0]?.participationStatus, "played");
    assert.equal(result.awayPlayers[0]?.participationStatus, null);
  });
});
