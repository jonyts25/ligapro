import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCaptainMatchScore,
  mapCaptainMatchRows,
  mapReservationRows,
  mapSeasonTeamNameRows,
  registrationStatusLabel,
} from "./captain-portal";

describe("captain-portal mappers", () => {
  it("mapSeasonTeamNameRows prefers display_name over team name", () => {
    const names = mapSeasonTeamNameRows([
      {
        id: "st-1",
        display_name: "Halcones FC",
        teams: { name: "Halcones" },
      },
      {
        id: "st-2",
        display_name: null,
        teams: { name: "Tigres" },
      },
    ]);

    assert.equal(names.get("st-1"), "Halcones FC");
    assert.equal(names.get("st-2"), "Tigres");
  });

  it("mapReservationRows extracts venue and field labels", () => {
    const reservations = mapReservationRows([
      {
        id: "res-1",
        starts_at: "2026-10-01T18:00:00.000Z",
        fields: {
          name: "Cancha 1",
          venues: { name: "Sede Norte" },
        },
      },
    ]);

    assert.deepEqual(reservations.get("res-1"), {
      startsAt: "2026-10-01T18:00:00.000Z",
      venueName: "Sede Norte",
      fieldName: "Cancha 1",
    });
  });

  it("mapCaptainMatchRows keeps upcoming matches and opponent label", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const names = new Map([
      ["st-home", "Local FC"],
      ["st-away", "Visit FC"],
    ]);
    const reservations = new Map([
      [
        "res-1",
        {
          startsAt: future,
          venueName: "Sede",
          fieldName: "Cancha",
        },
      ],
    ]);

    const rows = mapCaptainMatchRows(
      [
        {
          id: "match-1",
          season_id: "season-1",
          organization_id: "org-1",
          home_season_team_id: "st-home",
          away_season_team_id: "st-away",
          round_number: 3,
          leg_number: null,
          calendar_status: "confirmado",
          field_reservation_id: "res-1",
          status: "scheduled",
          home_score: null,
          away_score: null,
        },
      ],
      "st-home",
      names,
      reservations,
      { limit: 5, upcomingOnly: true }
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.opponentName, "Visit FC");
    assert.equal(rows[0]?.isOwnHome, true);
    assert.equal(rows[0]?.calendarStatus, "confirmado");
  });

  it("formatCaptainMatchScore flips perspective for away matches", () => {
    assert.equal(
      formatCaptainMatchScore({
        id: "m1",
        seasonId: "s1",
        organizationId: "o1",
        roundNumber: 1,
        legNumber: null,
        calendarStatus: "programado",
        status: "played",
        homeSeasonTeamId: "h",
        awaySeasonTeamId: "a",
        homeName: "H",
        awayName: "A",
        isOwnHome: true,
        opponentName: "A",
        startsAt: null,
        venueName: null,
        fieldName: null,
        isProgrammed: false,
        homeScore: 2,
        awayScore: 1,
      }),
      "2 - 1"
    );

    assert.equal(
      formatCaptainMatchScore({
        id: "m2",
        seasonId: "s1",
        organizationId: "o1",
        roundNumber: 1,
        legNumber: null,
        calendarStatus: "programado",
        status: "played",
        homeSeasonTeamId: "h",
        awaySeasonTeamId: "a",
        homeName: "H",
        awayName: "A",
        isOwnHome: false,
        opponentName: "H",
        startsAt: null,
        venueName: null,
        fieldName: null,
        isProgrammed: false,
        homeScore: 2,
        awayScore: 1,
      }),
      "1 - 2"
    );
  });

  it("registrationStatusLabel maps known statuses", () => {
    assert.equal(registrationStatusLabel("active"), "Activo");
    assert.equal(registrationStatusLabel("suspended"), "Suspendido");
  });
});
