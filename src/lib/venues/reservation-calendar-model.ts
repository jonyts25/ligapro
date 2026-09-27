import { addDaysIso } from "@/lib/fixtures/open-slots";
import { timeToMinutes } from "@/lib/venues/organization-availability-grid";
import type {
  ReservationCalendarEntry,
  ReservationCalendarFieldRow,
} from "@/lib/venues/reservation-calendar-types";
import {
  dayOfWeekFromIso,
  formatCalendarDayLabel,
  getWeekEnd,
} from "@/lib/venues/reservation-calendar-week";

export type ReservationCalendarBlockCell = ReservationCalendarEntry & {
  dayDate: string;
  dayLabel: string;
  dayOfWeek: number;
  startsAtLabel: string;
  endsAtLabel: string;
};

export type ReservationCalendarCell = {
  dayDate: string;
  dayOfWeek: number;
  hour: number;
  reservations: ReservationCalendarBlockCell[];
};

export type ReservationCalendarModel = {
  weekStart: string;
  weekEnd: string;
  hourRange: { startHour: number; endHour: number };
  hourSlots: number[];
  dayColumns: Array<{ dayDate: string; dayLabel: string; dayOfWeek: number }>;
  rows: Array<{
    field: ReservationCalendarFieldRow;
    cells: ReservationCalendarCell[];
  }>;
};

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 22;

function normalizeTimeLabel(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  });
}

function computeHourRange(
  reservations: ReservationCalendarEntry[]
): { startHour: number; endHour: number } {
  if (reservations.length === 0) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  let minMinutes = DEFAULT_START_HOUR * 60;
  let maxMinutes = DEFAULT_END_HOUR * 60;

  for (const reservation of reservations) {
    const startLabel = normalizeTimeLabel(reservation.startsAt);
    const endLabel = normalizeTimeLabel(reservation.endsAt);
    minMinutes = Math.min(minMinutes, timeToMinutes(startLabel));
    maxMinutes = Math.max(maxMinutes, timeToMinutes(endLabel));
  }

  const startHour = Math.max(0, Math.floor(minMinutes / 60) - 1);
  const endHour = Math.min(24, Math.ceil(maxMinutes / 60) + 1);

  return {
    startHour: Math.min(startHour, DEFAULT_START_HOUR),
    endHour: Math.max(endHour, DEFAULT_END_HOUR),
  };
}

function reservationOverlapsHour(
  reservation: ReservationCalendarEntry,
  dayDate: string,
  hour: number
): boolean {
  const hourStartMinutes = hour * 60;
  const hourEndMinutes = (hour + 1) * 60;

  const startsAtDate = reservation.startsAt.slice(0, 10);
  const endsAtDate = reservation.endsAt.slice(0, 10);

  if (dayDate < startsAtDate || dayDate > endsAtDate) {
    return false;
  }

  const startMinutes = timeToMinutes(normalizeTimeLabel(reservation.startsAt));
  const endMinutes = timeToMinutes(normalizeTimeLabel(reservation.endsAt));

  if (dayDate === startsAtDate && dayDate === endsAtDate) {
    return startMinutes < hourEndMinutes && endMinutes > hourStartMinutes;
  }

  if (dayDate === startsAtDate) {
    return startMinutes < hourEndMinutes;
  }

  if (dayDate === endsAtDate) {
    return endMinutes > hourStartMinutes;
  }

  return true;
}

export function sortFieldsForCalendar(
  fields: ReservationCalendarFieldRow[]
): ReservationCalendarFieldRow[] {
  const roots = fields
    .filter((field) => !field.parentFieldId)
    .sort((a, b) => a.fieldName.localeCompare(b.fieldName, "es"));

  const ordered: ReservationCalendarFieldRow[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    ordered.push(root);
    seen.add(root.fieldId);

    const children = fields
      .filter((field) => field.parentFieldId === root.fieldId)
      .sort((a, b) => a.fieldName.localeCompare(b.fieldName, "es"));

    for (const child of children) {
      ordered.push(child);
      seen.add(child.fieldId);
    }
  }

  for (const field of fields) {
    if (!seen.has(field.fieldId)) {
      ordered.push(field);
    }
  }

  return ordered;
}

export function buildFieldCalendarLabel(field: ReservationCalendarFieldRow): string {
  if (field.parentFieldName) {
    return `${field.fieldName} · Mitad de ${field.parentFieldName}`;
  }
  if (field.childCount > 0) {
    return `${field.fieldName} · Dividida en 2`;
  }
  return field.fieldName;
}

export function buildReservationCalendarModel(input: {
  weekStart: string;
  fields: ReservationCalendarFieldRow[];
  reservations: ReservationCalendarEntry[];
}): ReservationCalendarModel {
  const weekEnd = getWeekEnd(input.weekStart);
  const hourRange = computeHourRange(input.reservations);
  const hourSlots = Array.from(
    { length: hourRange.endHour - hourRange.startHour },
    (_, index) => hourRange.startHour + index
  );

  const dayColumns = Array.from({ length: 7 }, (_, offset) => {
    const dayDate = addDaysIso(input.weekStart, offset);
    return {
      dayDate,
      dayLabel: formatCalendarDayLabel(dayDate),
      dayOfWeek: dayOfWeekFromIso(dayDate),
    };
  });

  const reservationBlocks: ReservationCalendarBlockCell[] =
    input.reservations.map((reservation) => {
      const dayDate = reservation.startsAt.slice(0, 10);
      return {
        ...reservation,
        dayDate,
        dayLabel: formatCalendarDayLabel(dayDate),
        dayOfWeek: dayOfWeekFromIso(dayDate),
        startsAtLabel: normalizeTimeLabel(reservation.startsAt),
        endsAtLabel: normalizeTimeLabel(reservation.endsAt),
      };
    });

  const reservationsByField = new Map<string, ReservationCalendarBlockCell[]>();
  for (const block of reservationBlocks) {
    const list = reservationsByField.get(block.fieldId) ?? [];
    list.push(block);
    reservationsByField.set(block.fieldId, list);
  }

  const orderedFields = sortFieldsForCalendar(input.fields).map((field) => ({
    ...field,
    fieldLabel: buildFieldCalendarLabel(field),
  }));

  const rows = orderedFields.map((field) => {
    const fieldReservations = reservationsByField.get(field.fieldId) ?? [];
    const cells: ReservationCalendarCell[] = [];

    for (const day of dayColumns) {
      for (const hour of hourSlots) {
        const reservations = fieldReservations.filter((reservation) =>
          reservationOverlapsHour(reservation, day.dayDate, hour)
        );
        cells.push({
          dayDate: day.dayDate,
          dayOfWeek: day.dayOfWeek,
          hour,
          reservations,
        });
      }
    }

    return { field, cells };
  });

  return {
    weekStart: input.weekStart,
    weekEnd,
    hourRange,
    hourSlots,
    dayColumns,
    rows,
  };
}
