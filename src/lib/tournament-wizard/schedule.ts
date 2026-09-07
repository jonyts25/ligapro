export function buildWizardScheduleForFields(
  fieldIds: string[],
  dayOfWeek: number,
  startsAt: string,
  endsAt: string
): {
  availabilityByField: Array<{
    fieldId: string;
    intervals: Array<{
      day_of_week: number;
      starts_at: string;
      ends_at: string;
    }>;
  }>;
  seasonBlocks: Array<{
    field_id: string;
    day_of_week: number;
    starts_at: string;
    ends_at: string;
  }>;
} {
  const interval = {
    day_of_week: dayOfWeek,
    starts_at: startsAt,
    ends_at: endsAt,
  };

  return {
    availabilityByField: fieldIds.map((fieldId) => ({
      fieldId,
      intervals: [interval],
    })),
    seasonBlocks: fieldIds.map((field_id) => ({
      field_id,
      day_of_week: dayOfWeek,
      starts_at: startsAt,
      ends_at: endsAt,
    })),
  };
}

export function defaultWizardFieldCount(
  canchasLimit: number | null,
  currentFields: number
): number {
  if (canchasLimit === null) {
    return 2;
  }

  const remaining = Math.max(0, canchasLimit - currentFields);
  if (remaining >= 2) return 2;
  if (remaining >= 1) return 1;
  return 1;
}

export function wizardStepHref(
  organizationId: string,
  step: "equipos" | "jugadores" | "horarios" | "generar",
  competitionId: string,
  seasonId: string
): string {
  return `/organizaciones/${organizationId}/torneos/asistente/${competitionId}/${seasonId}/${step}`;
}
