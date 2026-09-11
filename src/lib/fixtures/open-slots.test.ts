import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMinutesToTimeSameDay,
  computeFieldOpenSlots,
  type ComputeFieldOpenSlotsInput,
} from "@/lib/fixtures/open-slots";
import { localMexicoCityToTimestamptz } from "@/lib/fixtures/timezone";

const baseInput = (
  overrides: Partial<ComputeFieldOpenSlotsInput> = {}
): ComputeFieldOpenSlotsInput => ({
  fromDate: "2026-09-14",
  toDate: "2026-09-20",
  slotMinutes: 90,
  seasonId: "season-a",
  availabilityRules: [
    { day_of_week: 1, starts_at: "18:00", ends_at: "22:00" },
    { day_of_week: 3, starts_at: "19:00", ends_at: "21:30" },
  ],
  foreignSeasonBlocks: [],
  reservations: [],
  maxSlots: 20,
  slotStepMinutes: 30,
  now: new Date("2026-09-14T12:00:00.000Z"),
  ...overrides,
});

describe("addMinutesToTimeSameDay", () => {
  it("adds minutes within the same calendar day", () => {
    assert.equal(addMinutesToTimeSameDay("18:00", 90), "19:30");
  });

  it("returns null when the slot would cross midnight", () => {
    assert.equal(addMinutesToTimeSameDay("23:30", 90), null);
  });
});

describe("computeFieldOpenSlots", () => {
  it("returns only slots inside weekly availability rules", () => {
    const result = computeFieldOpenSlots(
      baseInput({
        fromDate: "2026-09-14",
        toDate: "2026-09-14",
        availabilityRules: [
          { day_of_week: 1, starts_at: "18:00", ends_at: "19:00" },
        ],
        slotMinutes: 60,
        slotStepMinutes: 30,
      })
    );

    assert.equal(result.hasWeeklyAvailability, true);
    assert.equal(result.slots.length, 1);
    assert.equal(result.slots[0]?.date, "2026-09-14");
    assert.equal(result.slots[0]?.startsAt, "18:00");
    assert.equal(result.slots[0]?.endsAt, "19:00");
    assert.ok(
      result.slots.every(
        (slot) => slot.startsAt >= "18:00" && slot.endsAt <= "19:00"
      )
    );
  });

  it("excludes slots blocked by another tournament season", () => {
    const result = computeFieldOpenSlots(
      baseInput({
        availabilityRules: [
          { day_of_week: 1, starts_at: "18:00", ends_at: "22:00" },
        ],
        foreignSeasonBlocks: [
          {
            season_id: "season-b",
            day_of_week: 1,
            starts_at: "18:00",
            ends_at: "20:00",
          },
        ],
        slotMinutes: 60,
        slotStepMinutes: 60,
        maxSlots: 10,
      })
    );

    assert.deepEqual(
      result.slots.map((slot) => slot.startsAt),
      ["20:00", "21:00"]
    );
  });

  it("excludes slots with confirmed reservations already taken", () => {
    const reservationStart =
      localMexicoCityToTimestamptz("2026-09-14", "18:00") ?? "";
    const reservationEnd = new Date(
      new Date(reservationStart).getTime() + 90 * 60_000
    ).toISOString();

    const result = computeFieldOpenSlots(
      baseInput({
        availabilityRules: [
          { day_of_week: 1, starts_at: "18:00", ends_at: "22:00" },
        ],
        reservations: [
          {
            id: "res-1",
            match_id: "match-other",
            starts_at: reservationStart,
            ends_at: reservationEnd,
          },
        ],
        slotMinutes: 90,
        slotStepMinutes: 30,
        maxSlots: 10,
        now: new Date("2026-09-01T12:00:00.000Z"),
      })
    );

    const blocked = result.slots.some(
      (slot) => slot.date === "2026-09-14" && slot.startsAt === "18:00"
    );
    assert.equal(blocked, false);
    assert.ok(result.slots.some((slot) => slot.startsAt === "20:30"));
  });

  it("uses match duration plus rest for the slot end time", () => {
    const result = computeFieldOpenSlots(
      baseInput({
        availabilityRules: [
          { day_of_week: 2, starts_at: "10:00", ends_at: "13:00" },
        ],
        fromDate: "2026-09-15",
        toDate: "2026-09-15",
        slotMinutes: 105,
        slotStepMinutes: 105,
        maxSlots: 5,
      })
    );

    assert.deepEqual(result.slots, [
      {
        date: "2026-09-15",
        startsAt: "10:00",
        endsAt: "11:45",
      },
    ]);
  });

  it("reports no weekly availability when the field has no rules", () => {
    const result = computeFieldOpenSlots(
      baseInput({
        availabilityRules: [],
      })
    );

    assert.equal(result.hasWeeklyAvailability, false);
    assert.deepEqual(result.slots, []);
  });

  it("stops after maxSlots suggestions", () => {
    const result = computeFieldOpenSlots(
      baseInput({
        availabilityRules: [
          { day_of_week: 1, starts_at: "08:00", ends_at: "22:00" },
          { day_of_week: 2, starts_at: "08:00", ends_at: "22:00" },
          { day_of_week: 3, starts_at: "08:00", ends_at: "22:00" },
          { day_of_week: 4, starts_at: "08:00", ends_at: "22:00" },
          { day_of_week: 5, starts_at: "08:00", ends_at: "22:00" },
        ],
        slotMinutes: 60,
        slotStepMinutes: 60,
        maxSlots: 5,
      })
    );

    assert.equal(result.slots.length, 5);
  });
});
