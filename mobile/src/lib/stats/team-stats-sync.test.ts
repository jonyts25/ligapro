import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyTeamStatDelta,
  buildSetMatchTeamStatsArgs,
  createDebouncedFlushScheduler,
  EMPTY_TEAM_STAT_COUNTS,
  TEAM_STATS_DEBOUNCE_MS,
} from "./team-stats-sync";

describe("team stats sync", () => {
  it("never decrements below zero", () => {
    const next = applyTeamStatDelta(EMPTY_TEAM_STAT_COUNTS, "shots", -1);
    assert.equal(next.shots, 0);
  });

  it("increments and decrements counters", () => {
    let counts = applyTeamStatDelta(EMPTY_TEAM_STAT_COUNTS, "corners", 1);
    counts = applyTeamStatDelta(counts, "corners", 1);
    counts = applyTeamStatDelta(counts, "corners", -1);
    assert.equal(counts.corners, 1);
  });

  it("builds full rpc payload with possession null", () => {
    const args = buildSetMatchTeamStatsArgs({
      matchId: "match-1",
      seasonTeamId: "st-home",
      counts: {
        shots: 4,
        shotsOnTarget: 2,
        corners: 3,
        fouls: 5,
        offsides: 1,
      },
    });

    assert.deepEqual(args, {
      p_match_id: "match-1",
      p_season_team_id: "st-home",
      p_shots: 4,
      p_shots_on_target: 2,
      p_possession_pct: null,
      p_corners: 3,
      p_fouls: 5,
      p_offsides: 1,
    });
  });

  it("debounces flushes so only the last scheduled team fires once", () => {
    const flushed: string[] = [];
    const timers = new Map<number, { fn: () => void; ms: number }>();
    let nextId = 1;

    const scheduler = createDebouncedFlushScheduler({
      debounceMs: TEAM_STATS_DEBOUNCE_MS,
      onFlush: (teamId) => flushed.push(teamId),
      setTimer: (fn, ms) => {
        const id = nextId++;
        timers.set(id, { fn, ms });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: (handle) => {
        timers.delete(handle as number);
      },
    });

    scheduler.schedule("home");
    scheduler.schedule("home");
    scheduler.schedule("home");

    assert.equal(timers.size, 1);
    assert.deepEqual(flushed, []);

    const pending = [...timers.values()][0];
    assert.equal(pending?.ms, TEAM_STATS_DEBOUNCE_MS);
    pending?.fn();

    assert.deepEqual(flushed, ["home"]);
    assert.equal(scheduler.pendingTeamIds().length, 0);
  });

  it("last-value-wins: debounce coalesces rapid touches into one flush callback", () => {
    let flushCount = 0;
    const scheduler = createDebouncedFlushScheduler({
      debounceMs: 50,
      onFlush: () => {
        flushCount += 1;
      },
    });

    scheduler.schedule("away");
    scheduler.schedule("away");
    scheduler.schedule("away");

    assert.equal(scheduler.pendingTeamIds().length, 1);
    assert.equal(flushCount, 0);
  });
});
