import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFieldCardBadges,
  canSplitField,
} from "./field-cards";

describe("buildFieldCardBadges", () => {
  it("shows parent badge for child fields", () => {
    const badges = buildFieldCardBadges({
      parentFieldName: "Cancha Central",
      childCount: 0,
      modality: "futbol_7",
      hourlyRate: null,
    });

    assert.deepEqual(badges[0], {
      label: "Mitad de Cancha Central",
      variant: "info",
    });
  });

  it("shows divided badge for parent fields with children", () => {
    const badges = buildFieldCardBadges({
      parentFieldName: null,
      childCount: 2,
      modality: null,
      hourlyRate: null,
    });

    assert.equal(
      badges.some((badge) => badge.label === "Dividida en 2"),
      true
    );
  });

  it("shows modality and hourly rate when configured", () => {
    const badges = buildFieldCardBadges({
      parentFieldName: null,
      childCount: 0,
      modality: "futbol_11",
      hourlyRate: 850,
    });

    assert.equal(
      badges.some((badge) => badge.label === "Fútbol 11"),
      true
    );
    assert.equal(
      badges.some((badge) => badge.label === "$850.00/h"),
      true
    );
  });

  it("returns no badges for plain unconfigured fields", () => {
    const badges = buildFieldCardBadges({
      parentFieldName: null,
      childCount: 0,
      modality: null,
      hourlyRate: null,
    });

    assert.deepEqual(badges, []);
  });
});

describe("canSplitField", () => {
  it("allows split only on root fields without children", () => {
    assert.equal(
      canSplitField({ parentFieldId: null, childCount: 0 }),
      true
    );
    assert.equal(
      canSplitField({ parentFieldId: "parent-1", childCount: 0 }),
      false
    );
    assert.equal(
      canSplitField({ parentFieldId: null, childCount: 2 }),
      false
    );
  });
});
