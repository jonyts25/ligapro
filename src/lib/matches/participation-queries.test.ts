import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapParticipationRows } from "@/lib/matches/participation-validation";

describe("participation query row mapping", () => {
  it("handles array-shaped player relation from Supabase", () => {
    const rows = mapParticipationRows([
      {
        id: "mp-2",
        match_id: "match-2",
        season_team_player_id: "stp-2",
        organization_id: "org-2",
        status: "no_show",
        called_by_profile_id: "profile-1",
        responded_at: "2026-01-02T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        season_team_players: {
          season_team_id: "st-2",
          jersey_number: null,
          players: [{ full_name: "Backup Player" }],
        },
      },
    ]);

    assert.equal(rows[0]?.playerName, "Backup Player");
    assert.equal(rows[0]?.status, "no_show");
    assert.equal(rows[0]?.calledByProfileId, "profile-1");
  });
});
