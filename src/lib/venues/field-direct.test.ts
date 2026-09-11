import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDirectFieldInsertRow,
  mapOrganizationFieldDetail,
} from "@/lib/venues/field-model";
import { fieldCardStatusLabel } from "@/lib/venues/field-cards";

describe("buildDirectFieldInsertRow", () => {
  it("creates organization-scoped fields with venue_id null", () => {
    const row = buildDirectFieldInsertRow({
      organizationId: "org-1",
      name: "  Cancha 1  ",
      address: "Av. Central 100",
      surfaceType: "césped",
      isActive: true,
    });

    assert.equal(row.organization_id, "org-1");
    assert.equal(row.name, "Cancha 1");
    assert.equal(row.address, "Av. Central 100");
    assert.equal(row.surface_type, "césped");
    assert.equal(row.is_active, true);
    assert.equal(row.venue_id, null);
  });
});

describe("mapOrganizationFieldDetail", () => {
  it("maps a field without venue as directly available when active", () => {
    const detail = mapOrganizationFieldDetail(
      {
        id: "field-1",
        organization_id: "org-1",
        venue_id: null,
        name: "Cancha Norte",
        address: "Zona industrial",
        surface_type: null,
        is_active: true,
      },
      []
    );

    assert.equal(detail.venue_id, null);
    assert.equal(detail.address, "Zona industrial");
    assert.equal(detail.effectivelyAvailable, true);
    assert.deepEqual(detail.intervals, []);
  });

  it("marks inactive direct fields as not effectively available", () => {
    const detail = mapOrganizationFieldDetail(
      {
        id: "field-2",
        organization_id: "org-1",
        venue_id: null,
        name: "Cancha Sur",
        address: null,
        surface_type: "sintético",
        is_active: false,
      },
      [{ day_of_week: 1, starts_at: "18:00", ends_at: "21:00" }]
    );

    assert.equal(detail.effectivelyAvailable, false);
    assert.equal(detail.intervals.length, 1);
  });
});

describe("fieldCardStatusLabel", () => {
  it('shows "Sin configurar" for fields without weekly availability', () => {
    assert.equal(
      fieldCardStatusLabel({
        fieldId: "f1",
        fieldName: "Cancha 1",
        address: null,
        surfaceType: null,
        isActive: true,
        hasWeeklyAvailability: false,
        activeBlockCount: 0,
      }),
      "Sin configurar"
    );
  });
});
