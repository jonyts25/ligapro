import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addPendingEvent,
  addPendingRosterValidation,
  applyEventSyncOutcome,
  applyRosterSyncOutcome,
  pendingEventsForMatch,
  type PendingMatchEvent,
} from "./offline-queue";

const baseEvent: PendingMatchEvent = {
  queueId: "q-1",
  clientDedupKey: "dedup-1",
  matchId: "match-1",
  seasonTeamPlayerId: "stp-1",
  eventType: "goal",
  minute: 12,
  notes: null,
  assistSeasonTeamPlayerId: null,
  createdAt: "2026-09-27T12:00:00.000Z",
  lastError: null,
};

describe("offline queue", () => {
  it("does not duplicate events with the same client dedup key", () => {
    const queue = addPendingEvent([], baseEvent);
    const again = addPendingEvent(queue, { ...baseEvent, queueId: "q-2" });
    assert.equal(again.length, 1);
  });

  it("removes an event after successful sync", () => {
    const queue = addPendingEvent([], baseEvent);
    const result = applyEventSyncOutcome(queue, "q-1", { kind: "success" });
    assert.equal(result.removed, true);
    assert.equal(result.queue.length, 0);
  });

  it("removes an event after a business rejection and surfaces the message", () => {
    const queue = addPendingEvent([], baseEvent);
    const result = applyEventSyncOutcome(queue, "q-1", {
      kind: "business",
      message: "Invalid event_type",
    });
    assert.equal(result.removed, true);
    assert.equal(result.message, "Invalid event_type");
  });

  it("keeps an event in the queue on network failure", () => {
    const queue = addPendingEvent([], baseEvent);
    const result = applyEventSyncOutcome(queue, "q-1", {
      kind: "network",
      message: "Sin conexión",
    });
    assert.equal(result.removed, false);
    assert.equal(result.queue[0]?.lastError, "Sin conexión");
    assert.equal(pendingEventsForMatch(result.queue, "match-1").length, 1);
  });

  it("replaces pending roster validation per match", () => {
    const first = addPendingRosterValidation([], {
      queueId: "r-1",
      matchId: "match-1",
      seasonTeamPlayerIds: ["a"],
      createdAt: "2026-09-27T12:00:00.000Z",
      lastError: null,
    });
    const second = addPendingRosterValidation(first, {
      queueId: "r-2",
      matchId: "match-1",
      seasonTeamPlayerIds: ["a", "b"],
      createdAt: "2026-09-27T12:01:00.000Z",
      lastError: null,
    });
    assert.equal(second.length, 1);
    assert.equal(second[0]?.queueId, "r-2");
  });

  it("removes roster validation after success", () => {
    const queue = addPendingRosterValidation([], {
      queueId: "r-1",
      matchId: "match-1",
      seasonTeamPlayerIds: ["a"],
      createdAt: "2026-09-27T12:00:00.000Z",
      lastError: null,
    });
    const result = applyRosterSyncOutcome(queue, "r-1", { kind: "success" });
    assert.equal(result.queue.length, 0);
  });
});
