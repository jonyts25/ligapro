export type FieldRecord = {
  id: string;
  organization_id: string;
  venue_id: string | null;
  name: string;
  address: string | null;
  surface_type: string | null;
  is_active: boolean;
};

export type AvailabilityInterval = {
  id?: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

export type FieldWithAvailability = FieldRecord & {
  intervals: AvailabilityInterval[];
  effectivelyAvailable: boolean;
};

export type FieldDetail = FieldWithAvailability;

export type VenueActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: {
    name?: string;
    address?: string | null;
    isActive?: boolean;
    surfaceType?: string | null;
  };
};

export const initialVenueActionState: VenueActionState = {
  ok: false,
  message: null,
};

export const DAY_LABELS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export function isFieldEffectivelyAvailable(fieldActive: boolean): boolean {
  return fieldActive;
}
