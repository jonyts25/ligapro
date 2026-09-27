import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  PendingMatchEvent,
  PendingRosterValidation,
} from "@/lib/sync/offline-queue";

const EVENTS_KEY = "ligapro.capture.pendingEvents";
const ROSTER_KEY = "ligapro.capture.pendingRoster";

export async function loadPendingEvents(): Promise<PendingMatchEvent[]> {
  const raw = await AsyncStorage.getItem(EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingMatchEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePendingEvents(
  queue: PendingMatchEvent[]
): Promise<void> {
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(queue));
}

export async function loadPendingRosterValidations(): Promise<
  PendingRosterValidation[]
> {
  const raw = await AsyncStorage.getItem(ROSTER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingRosterValidation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePendingRosterValidations(
  queue: PendingRosterValidation[]
): Promise<void> {
  await AsyncStorage.setItem(ROSTER_KEY, JSON.stringify(queue));
}
