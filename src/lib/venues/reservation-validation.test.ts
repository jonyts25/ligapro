import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateCancelFieldReservation,
  validateCreateFieldReservationInput,
} from "@/lib/venues/reservation-validation";

describe("validateCreateFieldReservationInput", () => {
  const baseInput = {
    organizationId: "org-1",
    fieldId: "field-1",
    reservationType: "private_rental",
    date: "2026-09-28",
    startTime: "18:00",
    endTime: "19:00",
    title: "Renta cumpleaños",
  };

  it("rejects reservation_type match", () => {
    const result = validateCreateFieldReservationInput({
      ...baseInput,
      reservationType: "match",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /no crea reservas de partido/i);
    }
  });

  it("rejects ends_at <= starts_at", () => {
    const result = validateCreateFieldReservationInput({
      ...baseInput,
      startTime: "19:00",
      endTime: "18:00",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /posterior/i);
      assert.ok(result.fieldErrors?.endTime);
    }
  });

  it("accepts valid non-match reservations", () => {
    const result = validateCreateFieldReservationInput(baseInput);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.reservationType, "private_rental");
      assert.ok(new Date(result.endsAt) > new Date(result.startsAt));
    }
  });
});

describe("validateCancelFieldReservation", () => {
  it("rejects cancelling match reservations", () => {
    const result = validateCancelFieldReservation({
      reservation_type: "match",
      status: "confirmed",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /desde su propia pantalla/i);
    }
  });

  it("accepts cancelling confirmed non-match reservations", () => {
    const result = validateCancelFieldReservation({
      reservation_type: "private_rental",
      status: "confirmed",
    });

    assert.equal(result.ok, true);
  });
});
