export const TEAM_STATS_DEBOUNCE_MS = 800;

export type TeamStatField =
  | "shots"
  | "shotsOnTarget"
  | "corners"
  | "fouls"
  | "offsides";

export type TeamStatCounts = Record<TeamStatField, number>;

export type TeamStatsSyncStatus = "saved" | "saving" | "pending_network";

export const EMPTY_TEAM_STAT_COUNTS: TeamStatCounts = {
  shots: 0,
  shotsOnTarget: 0,
  corners: 0,
  fouls: 0,
  offsides: 0,
};

export function clampTeamStatValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function applyTeamStatDelta(
  counts: TeamStatCounts,
  field: TeamStatField,
  delta: 1 | -1
): TeamStatCounts {
  return {
    ...counts,
    [field]: clampTeamStatValue(counts[field] + delta),
  };
}

export function buildSetMatchTeamStatsArgs(input: {
  matchId: string;
  seasonTeamId: string;
  counts: TeamStatCounts;
}) {
  return {
    p_match_id: input.matchId,
    p_season_team_id: input.seasonTeamId,
    p_shots: input.counts.shots,
    p_shots_on_target: input.counts.shotsOnTarget,
    p_possession_pct: null,
    p_corners: input.counts.corners,
    p_fouls: input.counts.fouls,
    p_offsides: input.counts.offsides,
  };
}

export function teamStatsFromRow(row: {
  shots: number | null;
  shots_on_target: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
} | null): TeamStatCounts {
  if (!row) return { ...EMPTY_TEAM_STAT_COUNTS };
  return {
    shots: clampTeamStatValue(row.shots ?? 0),
    shotsOnTarget: clampTeamStatValue(row.shots_on_target ?? 0),
    corners: clampTeamStatValue(row.corners ?? 0),
    fouls: clampTeamStatValue(row.fouls ?? 0),
    offsides: clampTeamStatValue(row.offsides ?? 0),
  };
}

export function syncStatusLabel(status: TeamStatsSyncStatus): string {
  switch (status) {
    case "saved":
      return "Guardado";
    case "saving":
      return "Guardando...";
    case "pending_network":
      return "Pendiente de red";
  }
}

type TimerHandle = ReturnType<typeof setTimeout>;

export type DebouncedFlushScheduler = {
  schedule: (teamId: string) => void;
  cancel: (teamId: string) => void;
  cancelAll: () => void;
  pendingTeamIds: () => string[];
};

export function createDebouncedFlushScheduler(input: {
  debounceMs?: number;
  onFlush: (teamId: string) => void;
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}): DebouncedFlushScheduler {
  const debounceMs = input.debounceMs ?? TEAM_STATS_DEBOUNCE_MS;
  const setTimer = input.setTimer ?? setTimeout;
  const clearTimer = input.clearTimer ?? clearTimeout;
  const timers = new Map<string, TimerHandle>();

  return {
    schedule(teamId: string) {
      const existing = timers.get(teamId);
      if (existing) clearTimer(existing);
      const handle = setTimer(() => {
        timers.delete(teamId);
        input.onFlush(teamId);
      }, debounceMs);
      timers.set(teamId, handle);
    },
    cancel(teamId: string) {
      const existing = timers.get(teamId);
      if (existing) {
        clearTimer(existing);
        timers.delete(teamId);
      }
    },
    cancelAll() {
      for (const handle of timers.values()) {
        clearTimer(handle);
      }
      timers.clear();
    },
    pendingTeamIds() {
      return [...timers.keys()];
    },
  };
}
