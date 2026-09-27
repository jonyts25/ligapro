import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFieldCalendarLabel,
  buildReservationCalendarModel,
  sortFieldsForCalendar,
} from "@/lib/venues/reservation-calendar-model";
import type {
  ReservationCalendarEntry,
  ReservationCalendarFieldRow,
} from "@/lib/venues/reservation-calendar-types";

const parentField: ReservationCalendarFieldRow = {
  fieldId: "parent-1",
  fieldName: "Cancha Central",
  fieldLabel: "Cancha Central",
  parentFieldId: null,
  parentFieldName: null,
  childCount: 2,
  isActive: true,
};

const childField: ReservationCalendarFieldRow = {
  fieldId: "child-1",
  fieldName: "Cancha Central A",
  fieldLabel: "Cancha Central A",
  parentFieldId: "parent-1",
  parentFieldName: "Cancha Central",
  childCount: 0,
  isActive: true,
};

describe("sortFieldsForCalendar", () => {
  it("groups children immediately after their parent", () => {
    const ordered = sortFieldsForCalendar([childField, parentField]);

    assert.equal(ordered[0]?.fieldId, "parent-1");
    assert.equal(ordered[1]?.fieldId, "child-1");
  });
});

describe("buildFieldCalendarLabel", () => {
  it("shows parent and child context labels", () => {
    assert.match(
      buildFieldCalendarLabel(childField),
      /Mitad de Cancha Central/
    );
    assert.match(buildFieldCalendarLabel(parentField), /Dividida en 2/);
  });
});

describe("buildReservationCalendarModel", () => {
  it("places confirmed reservations in the matching field/day/hour cells", () => {
    const reservation: ReservationCalendarEntry = {
      id: "res-1",
      fieldId: "child-1",
      fieldName: "Cancha Central A",
      reservationType: "private_rental",
      title: "Renta",
      startsAt: "2026-09-28T00:00:00.000Z",
      endsAt: "2026-09-28T01:00:00.000Z",
      status: "confirmed",
      matchId: null,
      matchHref: null,
      canCancel: true,
      displayLabel: "Renta",
    };

    const model = buildReservationCalendarModel({
      weekStart: "2026-09-27",
      fields: [parentField, childField],
      reservations: [reservation],
    });

    const childRow = model.rows.find((row) => row.field.fieldId === "child-1");
    assert.ok(childRow);
    const occupiedCell = childRow?.cells.find(
      (cell) => cell.reservations.length > 0
    );
    assert.ok(occupiedCell);
    assert.equal(occupiedCell?.reservations[0]?.id, "res-1");
  });
});
