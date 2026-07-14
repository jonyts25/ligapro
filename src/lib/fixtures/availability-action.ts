"use server";

import { getFieldAvailabilityForDate } from "@/lib/fixtures/queries";

export async function loadFieldAvailabilityAction(
  organizationId: string,
  fieldId: string,
  dateISO: string
) {
  if (!organizationId || !fieldId || !dateISO) return [];
  return getFieldAvailabilityForDate(organizationId, fieldId, dateISO);
}
