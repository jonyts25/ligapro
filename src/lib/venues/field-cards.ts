export type OrganizationFieldCard = {
  fieldId: string;
  fieldName: string;
  address: string | null;
  surfaceType: string | null;
  isActive: boolean;
  hasWeeklyAvailability: boolean;
  activeBlockCount: number;
};

export function fieldCardStatusLabel(field: OrganizationFieldCard): string {
  if (!field.hasWeeklyAvailability) {
    return "Sin configurar";
  }
  if (field.activeBlockCount === 0) {
    return "Sin bloqueos de torneo";
  }
  if (field.activeBlockCount === 1) {
    return "1 bloqueo de torneo";
  }
  return `${field.activeBlockCount} bloqueos de torneo`;
}
