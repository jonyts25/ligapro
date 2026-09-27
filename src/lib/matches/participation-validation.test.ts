import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMatchParticipationClosed,
  mapParticipationRows,
  parseParticipationStatus,
  parseSeasonTeamPlayerIds,
  validateSetMatchParticipantsInput,
  validateValidateMatchRosterInput,
} from "@/lib/matches/participation-validation";

describe("participation validation helpers", () => {
  it("parses comma-separated player ids", () => {
    assert.deepEqual(parseSeasonTeamPlayerIds("a, b,,c"), ["a", "b", "c"]);
    assert.deepEqual(parseSeasonTeamPlayerIds(""), []);
  });

  it("accepts settable participation statuses only", () => {
    assert.equal(parseParticipationStatus("called"), "called");
    assert.equal(parseParticipationStatus("played"), null);
  });

  it("detects closed match statuses", () => {
    assert.equal(isMatchParticipationClosed("finished"), true);
    assert.equal(isMatchParticipationClosed("in_progress"), false);
  });

  it("validates set_match_participants input", () => {
    const ok = validateSetMatchParticipantsInput({
      organizationId: "org",
      competitionId: "comp",
      seasonId: "season",
      matchId: "match",
      seasonTeamPlayerIds: ["stp-1"],
      status: "called",
    });
    assert.deepEqual(ok, { ok: true });

    const missing = validateSetMatchParticipantsInput({
      organizationId: "",
      competitionId: "comp",
      seasonId: "season",
      matchId: "match",
      seasonTeamPlayerIds: ["stp-1"],
      status: "called",
    });
    assert.equal(missing.ok, false);
  });

  it("validates validate_match_roster input", () => {
    const ok = validateValidateMatchRosterInput({
      organizationId: "org",
      competitionId: "comp",
      seasonId: "season",
      matchId: "match",
      seasonTeamPlayerIds: ["stp-1"],
    });
    assert.deepEqual(ok, { ok: true });

    const empty = validateValidateMatchRosterInput({
      organizationId: "org",
      competitionId: "comp",
      seasonId: "season",
      matchId: "match",
      seasonTeamPlayerIds: [],
    });
    assert.equal(empty.ok, false);
  });

  it("maps participation rows with player names", () => {
    const rows = mapParticipationRows([
      {
        id: "mp-1",
        match_id: "match-1",
        season_team_player_id: "stp-1",
        organization_id: "org-1",
        status: "played",
        called_by_profile_id: null,
        responded_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        season_team_players: {
          season_team_id: "st-1",
          jersey_number: 10,
          players: { full_name: "Alex Rivera" },
        },
      },
    ]);

    assert.equal(rows[0]?.playerName, "Alex Rivera");
    assert.equal(rows[0]?.jerseyNumber, 10);
    assert.equal(rows[0]?.status, "played");
  });
});
