export type PendingMatchEvent = {
  queueId: string;
  clientDedupKey: string;
  matchId: string;
  seasonTeamPlayerId: string;
  eventType: string;
  minute: number;
  notes: string | null;
  assistSeasonTeamPlayerId: string | null;
  createdAt: string;
  lastError: string | null;
};

export type PendingRosterValidation = {
  queueId: string;
  matchId: string;
  seasonTeamPlayerIds: string[];
  createdAt: string;
  lastError: string | null;
};

export type SyncOutcome =
  | { kind: "success" }
  | { kind: "business"; message: string }
  | { kind: "network"; message: string };

export function addPendingEvent(
  queue: PendingMatchEvent[],
  item: PendingMatchEvent
): PendingMatchEvent[] {
  if (queue.some((row) => row.clientDedupKey === item.clientDedupKey)) {
    return queue;
  }
  return [...queue, item];
}

export function addPendingRosterValidation(
  queue: PendingRosterValidation[],
  item: PendingRosterValidation
): PendingRosterValidation[] {
  const withoutSameMatch = queue.filter((row) => row.matchId !== item.matchId);
  return [...withoutSameMatch, item];
}

export function applyEventSyncOutcome(
  queue: PendingMatchEvent[],
  queueId: string,
  outcome: SyncOutcome
): { queue: PendingMatchEvent[]; removed: boolean; message?: string } {
  const item = queue.find((row) => row.queueId === queueId);
  if (!item) {
    return { queue, removed: false };
  }

  if (outcome.kind === "success" || outcome.kind === "business") {
    return {
      queue: queue.filter((row) => row.queueId !== queueId),
      removed: true,
      message: outcome.kind === "business" ? outcome.message : undefined,
    };
  }

  return {
    queue: queue.map((row) =>
      row.queueId === queueId
        ? { ...row, lastError: outcome.message }
        : row
    ),
    removed: false,
    message: outcome.message,
  };
}

export function applyRosterSyncOutcome(
  queue: PendingRosterValidation[],
  queueId: string,
  outcome: SyncOutcome
): { queue: PendingRosterValidation[]; removed: boolean; message?: string } {
  const item = queue.find((row) => row.queueId === queueId);
  if (!item) {
    return { queue, removed: false };
  }

  if (outcome.kind === "success" || outcome.kind === "business") {
    return {
      queue: queue.filter((row) => row.queueId !== queueId),
      removed: true,
      message: outcome.kind === "business" ? outcome.message : undefined,
    };
  }

  return {
    queue: queue.map((row) =>
      row.queueId === queueId
        ? { ...row, lastError: outcome.message }
        : row
    ),
    removed: false,
    message: outcome.message,
  };
}

export function pendingEventsForMatch(
  queue: PendingMatchEvent[],
  matchId: string
): PendingMatchEvent[] {
  return queue.filter((row) => row.matchId === matchId);
}

export function pendingRosterForMatch(
  queue: PendingRosterValidation[],
  matchId: string
): PendingRosterValidation | null {
  return queue.find((row) => row.matchId === matchId) ?? null;
}
