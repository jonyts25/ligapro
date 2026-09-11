import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOrganizationSeasonFieldBlocks } from "@/lib/season-fields/organization-blocks";

describe("normalizeOrganizationSeasonFieldBlocks", () => {
  it("returns blocks from every field and tournament in the organization", () => {
    const rows = normalizeOrganizationSeasonFieldBlocks([
      {
        id: "block-a",
        field_id: "field-1",
        day_of_week: 1,
        starts_at: "18:00:00",
        ends_at: "20:00:00",
        season_id: "season-a",
        seasons: {
          name: "Temporada A",
          competition_id: "comp-a",
          competitions: { name: "Liga A" },
        },
      },
      {
        id: "block-b",
        field_id: "field-2",
        day_of_week: 3,
        starts_at: "19:00:00",
        ends_at: "21:00:00",
        season_id: "season-b",
        seasons: {
          name: "Temporada B",
          competition_id: "comp-b",
          competitions: { name: "Liga B" },
        },
      },
      {
        id: "block-c",
        field_id: "field-1",
        day_of_week: 5,
        starts_at: "10:00:00",
        ends_at: "12:00:00",
        season_id: "season-c",
        seasons: {
          name: "Temporada C",
          competition_id: "comp-c",
          competitions: { name: "Copa C" },
        },
      },
    ]);

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.competitionName).sort(),
      ["Copa C", "Liga A", "Liga B"]
    );
    assert.deepEqual(
      rows.map((row) => row.fieldId).sort(),
      ["field-1", "field-1", "field-2"]
    );
    assert.equal(rows[0].startsAt, "18:00");
  });
});
