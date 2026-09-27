import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  buildMatchRosterForCapture,
  formatRosterSuspensionAlert,
  mapMatchRosterEligibilityRows,
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

  it("maps team names, logos, participation and eligibility", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    const participation = new Map<string, MatchParticipationStatus>([
      ["stp-home-1", "played"],
    ]);
    const eligibility = mapMatchRosterEligibilityRows([
      {
        season_team_player_id: "stp-home-1",
        is_suspended: true,
        matches_remaining: 2,
        suspension_type: "direct_red",
      },
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
      eligibilityByPlayer: eligibility,
    });

    assert.equal(result.halfDurationMinutes, 45);
    assert.equal(result.homeTeamName, "Halcones");
    assert.equal(result.awayTeamName, "Visitantes FC");
    assert.ok(result.homeTeamLogoUrl?.includes("team-logos"));
    assert.equal(result.awayTeamLogoUrl, null);
    assert.equal(result.homePlayers[0]?.participationStatus, "played");
    assert.equal(result.homePlayers[0]?.isSuspended, true);
    assert.equal(result.homePlayers[0]?.matchesRemaining, 2);
    assert.equal(result.homePlayers[0]?.suspensionType, "direct_red");
    assert.equal(result.awayPlayers[0]?.isSuspended, false);
    assert.equal(result.awayPlayers[0]?.matchesRemaining, 0);
  });
});

describe("formatRosterSuspensionAlert", () => {
  it("returns null when player is not suspended", () => {
    assert.equal(
      formatRosterSuspensionAlert({ isSuspended: false, matchesRemaining: 0 }),
      null
    );
  });

  it("formats singular and plural match counts", () => {
    assert.equal(
      formatRosterSuspensionAlert({ isSuspended: true, matchesRemaining: 1 }),
      "Suspendido — 1 partido"
    );
    assert.equal(
      formatRosterSuspensionAlert({ isSuspended: true, matchesRemaining: 3 }),
      "Suspendido — 3 partidos"
    );
  });
});

describe("mapMatchRosterEligibilityRows", () => {
  it("maps rpc rows by season_team_player_id", () => {
    const map = mapMatchRosterEligibilityRows([
      {
        season_team_player_id: "stp-1",
        is_suspended: true,
        matches_remaining: 2,
        suspension_type: "accumulation",
      },
    ]);

    assert.equal(map.get("stp-1")?.isSuspended, true);
    assert.equal(map.get("stp-1")?.matchesRemaining, 2);
    assert.equal(map.get("stp-1")?.suspensionType, "accumulation");
  });
});
