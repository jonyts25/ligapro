import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrganizationAvailabilityGridModel } from "@/lib/venues/organization-availability-grid";

describe("buildOrganizationAvailabilityGridModel", () => {
  it("marks blocked cells with tournament blocks and keeps unconfigured fields visible", () => {
    const model = buildOrganizationAvailabilityGridModel({
      fields: [
        {
          fieldId: "field-1",
          fieldName: "Cancha 1",
          fieldLabel: "Cancha 1",
          hasWeeklyAvailability: true,
        },
        {
          fieldId: "field-2",
          fieldName: "Cancha 2",
          fieldLabel: "Cancha 2",
          hasWeeklyAvailability: false,
        },
      ],
      availabilityRules: [
        {
          fieldId: "field-1",
          dayOfWeek: 1,
          startsAt: "18:00",
          endsAt: "21:00",
        },
      ],
      blocks: [
        {
          id: "block-1",
          fieldId: "field-1",
          seasonId: "season-1",
          seasonName: "Temporada 2025",
          competitionId: "comp-1",
          competitionName: "Liga MX",
          dayOfWeek: 1,
          startsAt: "19:00",
          endsAt: "20:00",
        },
      ],
    });

    assert.equal(model.hourRange.startHour, 18);
    assert.equal(model.hourRange.endHour, 21);

    const field1Blocked = model.rows[0].cells.find(
      (cell) => cell.dayOfWeek === 1 && cell.hour === 19
    );
    assert.equal(field1Blocked?.kind, "blocked");
    assert.equal(field1Blocked?.blocks[0]?.competitionName, "Liga MX");

    const field2Cells = model.rows[1].cells;
    assert.ok(field2Cells.length > 0);
    assert.equal(field2Cells[0]?.kind, "unconfigured");
  });
});
