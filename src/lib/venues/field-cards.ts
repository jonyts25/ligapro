import { fieldModalityLabel } from "@/lib/venues/field-modality";

export type OrganizationFieldCard = {
  fieldId: string;
  fieldName: string;
  address: string | null;
  surfaceType: string | null;
  isActive: boolean;
  hasWeeklyAvailability: boolean;
  activeBlockCount: number;
  parentFieldId: string | null;
  parentFieldName: string | null;
  childCount: number;
  modality: string | null;
  hourlyRate: number | null;
};

export type FieldCardBadge = {
  label: string;
  variant: "default" | "info" | "success" | "warning";
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

export function buildFieldCardBadges(field: {
  parentFieldName: string | null;
  childCount: number;
  modality: string | null;
  hourlyRate: number | null;
}): FieldCardBadge[] {
  const badges: FieldCardBadge[] = [];

  if (field.parentFieldName) {
    badges.push({
      label: `Mitad de ${field.parentFieldName}`,
      variant: "info",
    });
  }

  if (field.childCount > 0) {
    badges.push({
      label: "Dividida en 2",
      variant: "info",
    });
  }

  const modalityLabel = fieldModalityLabel(field.modality);
  if (modalityLabel) {
    badges.push({ label: modalityLabel, variant: "default" });
  }

  if (field.hourlyRate != null) {
    badges.push({
      label: `$${field.hourlyRate.toFixed(2)}/h`,
      variant: "default",
    });
  }

  return badges;
}

export function canSplitField(field: {
  parentFieldId: string | null;
  childCount: number;
}): boolean {
  return field.parentFieldId === null && field.childCount === 0;
}
