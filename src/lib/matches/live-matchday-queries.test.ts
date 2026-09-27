import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLiveMatchdayAlerts,
  getMexicoCityDateString,
  shiftMexicoCityDateString,
} from "./live-matchday-core";

const START = "2026-09-27T18:00:00.000Z";

describe("buildLiveMatchdayAlerts", () => {
  it("returns no alerts for a normal in-progress match", () => {
    const alerts = buildLiveMatchdayAlerts({
      startsAt: START,
      status: "in_progress",
      hasConfirmedReferee: true,
      hasOpenDispute: false,
      isResultOfficial: false,
      homeValidatedCount: 5,
      awayValidatedCount: 4,
      matchDurationMinutes: 90,
      nowMs: new Date(START).getTime() + 10 * 60_000,
    });

    assert.deepEqual(alerts, []);
  });

  it("flags missing confirmed referee near kickoff", () => {
    const alerts = buildLiveMatchdayAlerts({
      startsAt: START,
      status: "scheduled",
      hasConfirmedReferee: false,
      hasOpenDispute: false,
      isResultOfficial: false,
      homeValidatedCount: 0,
      awayValidatedCount: 0,
      matchDurationMinutes: 90,
      nowMs: new Date(START).getTime() - 15 * 60_000,
    });

    assert.ok(alerts.some((a) => a.id === "no_confirmed_referee"));
  });

  it("flags uncaptured result after estimated end", () => {
    const alerts = buildLiveMatchdayAlerts({
      startsAt: START,
      status: "scheduled",
      hasConfirmedReferee: true,
      hasOpenDispute: false,
      isResultOfficial: false,
      homeValidatedCount: 3,
      awayValidatedCount: 3,
      matchDurationMinutes: 90,
      nowMs: new Date(START).getTime() + 91 * 60_000,
    });

    assert.ok(alerts.some((a) => a.id === "result_not_captured"));
  });

  it("flags open dispute", () => {
    const alerts = buildLiveMatchdayAlerts({
      startsAt: START,
      status: "finished",
      hasConfirmedReferee: true,
      hasOpenDispute: true,
      isResultOfficial: false,
      homeValidatedCount: 5,
      awayValidatedCount: 5,
      matchDurationMinutes: 90,
      nowMs: new Date(START).getTime() + 120 * 60_000,
    });

    assert.ok(alerts.some((a) => a.id === "open_dispute"));
    assert.equal(
      alerts.some((a) => a.id === "pending_approval"),
      false
    );
  });

  it("flags pending approval on finished match without dispute", () => {
    const alerts = buildLiveMatchdayAlerts({
      startsAt: START,
      status: "finished",
      hasConfirmedReferee: true,
      hasOpenDispute: false,
      isResultOfficial: false,
      homeValidatedCount: 5,
      awayValidatedCount: 5,
      matchDurationMinutes: 90,
      nowMs: new Date(START).getTime() + 120 * 60_000,
    });

    assert.ok(alerts.some((a) => a.id === "pending_approval"));
  });

  it("flags roster not validated after kickoff", () => {
    const alerts = buildLiveMatchdayAlerts({
      startsAt: START,
      status: "in_progress",
      hasConfirmedReferee: true,
      hasOpenDispute: false,
      isResultOfficial: false,
      homeValidatedCount: 0,
      awayValidatedCount: 0,
      matchDurationMinutes: 90,
      nowMs: new Date(START).getTime() + 5 * 60_000,
    });

    assert.ok(alerts.some((a) => a.id === "roster_not_validated"));
  });
});

describe("mexico city date helpers", () => {
  it("formats and shifts local dates", () => {
    const today = getMexicoCityDateString(new Date("2026-09-27T15:00:00.000Z"));
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(shiftMexicoCityDateString("2026-09-27", 1), "2026-09-28");
    assert.equal(shiftMexicoCityDateString("2026-09-27", -1), "2026-09-26");
  });
});
