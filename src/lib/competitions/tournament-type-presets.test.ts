import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapPresetToSeasonSetupFormValues,
  type TournamentTypePreset,
} from "./tournament-type-presets";

const samplePreset: TournamentTypePreset = {
  modality: "futbol_7",
  label: "Fútbol 7",
  playersOnField: 7,
  halvesCount: 2,
  matchDurationMinutes: 50,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  allowDraws: true,
  minimumRestMinutes: 0,
  yellowCardLimit: 5,
  suspensionMatches: 1,
  minRosterSize: 10,
  maxRosterSize: 16,
  updatedAt: null,
};

describe("mapPresetToSeasonSetupFormValues", () => {
  it("maps preset fields to existing season setup form values", () => {
    const result = mapPresetToSeasonSetupFormValues(samplePreset);

    assert.deepEqual(result, {
      matchDurationMinutes: 50,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      allowDraws: true,
      minimumRestMinutes: 0,
      yellowCardLimit: 5,
      suspensionMatches: 1,
    });
  });

  it("reflects edited preset values", () => {
    const edited = mapPresetToSeasonSetupFormValues({
      ...samplePreset,
      matchDurationMinutes: 55,
      pointsWin: 4,
      allowDraws: false,
    });

    assert.equal(edited.matchDurationMinutes, 55);
    assert.equal(edited.pointsWin, 4);
    assert.equal(edited.allowDraws, false);
  });
});
