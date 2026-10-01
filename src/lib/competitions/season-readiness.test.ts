import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSeasonReadinessItems,
  getSeasonReadinessStatus,
  seasonReadinessBlockedMessage,
} from "@/lib/competitions/season-readiness";
import type { SeasonDetail } from "@/lib/competitions/types";

function baseSeason(
  overrides: Partial<SeasonDetail["readiness"]> = {}
): Pick<SeasonDetail, "format_type" | "readiness"> {
  return {
    format_type: "round_robin",
    readiness: {
      activeVenues: 1,
      effectiveActiveFields: 2,
      teamCount: 4,
      activePlayerCount: 20,
      teamsWithCaptain: 4,
      fixtureGenerated: true,
      totalMatches: 6,
      scheduledMatches: 6,
      pendingMatches: 0,
      preparationLabel: "Calendario listo",
      ...overrides,
    },
  };
}

describe("getSeasonReadinessStatus", () => {
  it("is complete when all league checklist items are green", () => {
    const status = getSeasonReadinessStatus(baseSeason());
    assert.equal(status.complete, true);
    assert.equal(status.pendingLabels.length, 0);
  });

  it("lists pending labels when checklist is incomplete", () => {
    const status = getSeasonReadinessStatus(
      baseSeason({ teamCount: 0, teamsWithCaptain: 0 })
    );
    assert.equal(status.complete, false);
    assert.ok(status.pendingLabels.includes("Equipos inscritos"));
    assert.equal(status.pendingLabels.includes("Equipos con capitán"), false);
  });

  it("shows captains as an amber warning and still allows publish", () => {
    const status = getSeasonReadinessStatus(
      baseSeason({ teamCount: 4, teamsWithCaptain: 1 })
    );
    const captains = status.items.find(
      (item) => item.label === "Equipos con capitán"
    );

    assert.equal(captains?.value, "1/4");
    assert.equal(captains?.ok, false);
    assert.equal(captains?.level, "recommended");
    assert.equal(status.complete, true);
    assert.equal(status.pendingLabels.includes("Equipos con capitán"), false);
  });

  it("requires at least two enrolled teams for round robin", () => {
    const items = getSeasonReadinessItems(baseSeason({ teamCount: 1 }));
    const teams = items.find((item) => item.label === "Equipos inscritos");

    assert.equal(teams?.ok, false);
    assert.equal(teams?.level, "required");
  });

  it("omits fixture items for knockout format", () => {
    const items = getSeasonReadinessItems({
      format_type: "knockout",
      readiness: baseSeason({ fixtureGenerated: false }).readiness,
    });
    assert.equal(items.some((item) => item.label === "Fixture generado"), false);
  });
});

describe("seasonReadinessBlockedMessage", () => {
  it("builds a human-readable message", () => {
    assert.equal(
      seasonReadinessBlockedMessage(["Equipos inscritos"]),
      "Aún no se puede publicar. Falta: Equipos inscritos."
    );
  });
});
