import { intervalsOverlap } from "@/lib/venues/availability-validation";
import { localMexicoCityToTimestamptz } from "@/lib/fixtures/timezone";
import { FIXTURE_TIMEZONE } from "@/lib/fixtures/types";

export const DEFAULT_OPEN_SLOTS_MAX = 8;
export const DEFAULT_OPEN_SLOTS_RANGE_DAYS = 21;
export const DEFAULT_OPEN_SLOT_STEP_MINUTES = 15;

export type FieldOpenSlot = {
  date: string;
  startsAt: string;
  endsAt: string;
};

export type WeeklyAvailabilityRule = {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

export type SeasonFieldBlockRow = {
  season_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

export type FieldReservationRow = {
  id: string;
  match_id: string | null;
  starts_at: string;
  ends_at: string;
};

export type ComputeFieldOpenSlotsInput = {
  fromDate: string;
  toDate: string;
  slotMinutes: number;
  seasonId: string;
  availabilityRules: WeeklyAvailabilityRule[];
  foreignSeasonBlocks: SeasonFieldBlockRow[];
  reservations: FieldReservationRow[];
  excludeReservationId?: string | null;
  maxSlots?: number;
  slotStepMinutes?: number;
  now?: Date;
};

export type FieldOpenSlotsResult = {
  slots: FieldOpenSlot[];
  hasWeeklyAvailability: boolean;
};

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export function addMinutesToTimeSameDay(
  timeHHMM: string,
  minutes: number
): string | null {
  const [h, m] = timeHHMM.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || minutes <= 0) return null;
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function dayOfWeekFromIsoDate(dateISO: string): number {
  const probe = new Date(`${dateISO}T12:00:00`);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: FIXTURE_TIMEZONE,
    weekday: "short",
  }).format(probe);
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dowMap[weekdayName] ?? 0;
}

export function addDaysIso(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function todayMexicoCityIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FIXTURE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function slotOverlapsForeignBlock(
  dayOfWeek: number,
  slotStart: string,
  slotEnd: string,
  seasonId: string,
  blocks: SeasonFieldBlockRow[]
): boolean {
  for (const block of blocks) {
    if (block.season_id === seasonId) continue;
    if (block.day_of_week !== dayOfWeek) continue;
    const blockStart = normalizeTime(block.starts_at);
    const blockEnd = normalizeTime(block.ends_at);
    if (intervalsOverlap(slotStart, slotEnd, blockStart, blockEnd)) {
      return true;
    }
  }
  return false;
}

function slotOverlapsReservation(
  dateISO: string,
  slotStart: string,
  slotEnd: string,
  slotMinutes: number,
  reservation: FieldReservationRow
): boolean {
  const slotStartIso = localMexicoCityToTimestamptz(dateISO, slotStart);
  if (!slotStartIso) return true;
  const slotEndMs =
    new Date(slotStartIso).getTime() + slotMinutes * 60_000;
  const slotEndIso = new Date(slotEndMs).toISOString();
  const rs = new Date(reservation.starts_at).getTime();
  const re = new Date(reservation.ends_at).getTime();
  const ss = new Date(slotStartIso).getTime();
  const se = new Date(slotEndIso).getTime();
  return ss < re && rs < se;
}

function slotFitsAvailabilityRule(
  slotStart: string,
  slotEnd: string,
  ruleStart: string,
  ruleEnd: string
): boolean {
  return slotStart >= ruleStart && slotEnd <= ruleEnd;
}

function generateStepTimes(
  ruleStart: string,
  ruleEnd: string,
  slotMinutes: number,
  stepMinutes: number
): string[] {
  const starts: string[] = [];
  const [startH, startM] = ruleStart.split(":").map(Number);
  const [endH, endM] = ruleEnd.split(":").map(Number);
  let cursor = startH * 60 + startM;
  const ruleEndMinutes = endH * 60 + endM;

  while (cursor + slotMinutes <= ruleEndMinutes) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    starts.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    );
    cursor += stepMinutes;
  }

  return starts;
}

export function computeFieldOpenSlots(
  input: ComputeFieldOpenSlotsInput
): FieldOpenSlotsResult {
  const {
    fromDate,
    toDate,
    slotMinutes,
    seasonId,
    availabilityRules,
    foreignSeasonBlocks,
    reservations,
    excludeReservationId,
    maxSlots = DEFAULT_OPEN_SLOTS_MAX,
    slotStepMinutes = DEFAULT_OPEN_SLOT_STEP_MINUTES,
    now = new Date(),
  } = input;

  if (slotMinutes <= 0) {
    return { slots: [], hasWeeklyAvailability: availabilityRules.length > 0 };
  }

  const hasWeeklyAvailability = availabilityRules.length > 0;
  if (!hasWeeklyAvailability) {
    return { slots: [], hasWeeklyAvailability: false };
  }

  const normalizedRules = availabilityRules.map((rule) => ({
    day_of_week: rule.day_of_week,
    starts_at: normalizeTime(rule.starts_at),
    ends_at: normalizeTime(rule.ends_at),
  }));

  const activeReservations = reservations.filter(
    (reservation) =>
      reservation.id !== excludeReservationId &&
      reservation.starts_at &&
      reservation.ends_at
  );

  const slots: FieldOpenSlot[] = [];
  let cursorDate = fromDate;

  while (cursorDate <= toDate && slots.length < maxSlots) {
    const dayOfWeek = dayOfWeekFromIsoDate(cursorDate);
    const dayRules = normalizedRules.filter(
      (rule) => rule.day_of_week === dayOfWeek
    );

    for (const rule of dayRules) {
      const candidateStarts = generateStepTimes(
        rule.starts_at,
        rule.ends_at,
        slotMinutes,
        slotStepMinutes
      );

      for (const slotStart of candidateStarts) {
        if (slots.length >= maxSlots) break;

        const slotEnd = addMinutesToTimeSameDay(slotStart, slotMinutes);
        if (!slotEnd) continue;

        if (
          !slotFitsAvailabilityRule(
            slotStart,
            slotEnd,
            rule.starts_at,
            rule.ends_at
          )
        ) {
          continue;
        }

        if (
          slotOverlapsForeignBlock(
            dayOfWeek,
            slotStart,
            slotEnd,
            seasonId,
            foreignSeasonBlocks
          )
        ) {
          continue;
        }

        const slotStartIso = localMexicoCityToTimestamptz(cursorDate, slotStart);
        if (!slotStartIso) continue;
        if (new Date(slotStartIso).getTime() <= now.getTime()) continue;

        const overlapsReservation = activeReservations.some((reservation) =>
          slotOverlapsReservation(
            cursorDate,
            slotStart,
            slotEnd,
            slotMinutes,
            reservation
          )
        );
        if (overlapsReservation) continue;

        slots.push({
          date: cursorDate,
          startsAt: slotStart,
          endsAt: slotEnd,
        });
      }
    }

    cursorDate = addDaysIso(cursorDate, 1);
  }

  slots.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startsAt.localeCompare(b.startsAt);
  });

  return {
    slots: slots.slice(0, maxSlots),
    hasWeeklyAvailability,
  };
}

export function formatOpenSlotLabel(slot: FieldOpenSlot): string {
  const dateLabel = new Intl.DateTimeFormat("es-MX", {
    timeZone: FIXTURE_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${slot.date}T12:00:00`));
  return `${dateLabel} · ${slot.startsAt}–${slot.endsAt}`;
}
