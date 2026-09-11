import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterFixtureRoundsByJornada,
  parseSelectedRound,
} from "@/lib/fixtures/calendar-filter";
import type { FixtureRoundGroup } from "@/lib/fixtures/types";

function round(
  roundNumber: number,
  programmed: boolean[]
): FixtureRoundGroup {
  return {
    roundNumber,
    legNumber: null,
    matches: programmed.map((isProgrammed, index) => ({
      id: `m-${roundNumber}-${index}`,
      seasonId: "season-1",
      organizationId: "org-1",
      roundNumber,
      legNumber: null,
      sequenceInRound: index + 1,
      roundLabel: null,
      status: "scheduled",
      homeSeasonTeamId: "home",
      awaySeasonTeamId: "away",
      homeName: "Local",
      awayName: "Visitante",
      homeScore: null,
      awayScore: null,
      isProgrammed,
      calendarStatus: "programado",
      schedule: {
        reservationId: null,
        fieldId: null,
        fieldName: null,
        venueId: null,
        venueName: null,
        startsAt: null,
        endsAt: null,
        fieldIsActive: null,
        venueIsActive: null,
      },
    })),
    byeSeasonTeamIds: [],
    byeNames: [],
  };
}

describe("parseSelectedRound", () => {
  it("parses numeric jornada values", () => {
    assert.equal(parseSelectedRound("3"), 3);
    assert.equal(parseSelectedRound(undefined), "all");
  });
});

describe("filterFixtureRoundsByJornada", () => {
  it("filters rounds by selected jornada", () => {
    const rounds = [round(1, [true]), round(2, [false, true])];
    const filtered = filterFixtureRoundsByJornada(rounds, 2);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.roundNumber, 2);
    assert.equal(filtered[0]?.matches.length, 2);
  });

  it("returns all rounds when jornada is all", () => {
    const rounds = [round(1, [true]), round(2, [true])];
    assert.equal(filterFixtureRoundsByJornada(rounds, "all").length, 2);
  });
});
