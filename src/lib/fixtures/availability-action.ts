"use server";

import {
  getFieldAvailabilityForDate,
  getFieldOpenSlots,
} from "@/lib/fixtures/queries";

export async function loadFieldAvailabilityAction(
  organizationId: string,
  fieldId: string,
  dateISO: string
) {
  if (!organizationId || !fieldId || !dateISO) return [];
  return getFieldAvailabilityForDate(organizationId, fieldId, dateISO);
}

export async function loadFieldOpenSlotsAction(input: {
  organizationId: string;
  fieldId: string;
  seasonId: string;
  excludeMatchId?: string;
  excludeReservationId?: string | null;
  slotMinutes?: number;
}) {
  const { organizationId, fieldId, seasonId, excludeMatchId, excludeReservationId, slotMinutes } =
    input;
  if (!organizationId || !fieldId || !seasonId) {
    return { slots: [], hasWeeklyAvailability: false };
  }

  const result = await getFieldOpenSlots(
    organizationId,
    fieldId,
    seasonId,
    {
      excludeMatchId,
      excludeReservationId,
      slotMinutes,
    }
  );

  return result ?? { slots: [], hasWeeklyAvailability: false };
}
