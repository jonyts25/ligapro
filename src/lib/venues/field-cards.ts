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
    return "0 bloqueos activos esta semana";
  }
  if (field.activeBlockCount === 1) {
    return "1 bloqueo activo esta semana";
  }
  return `${field.activeBlockCount} bloqueos activos esta semana`;
}
