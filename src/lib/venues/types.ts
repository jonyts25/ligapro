export type VenueRecord = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  is_active: boolean;
};

export type FieldRecord = {
  id: string;
  venue_id: string;
  organization_id: string;
  name: string;
  surface_type: string | null;
  is_active: boolean;
};

export type AvailabilityInterval = {
  id?: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

export type VenueListItem = VenueRecord & {
  fieldCount: number;
};

export type FieldWithAvailability = FieldRecord & {
  intervals: AvailabilityInterval[];
  effectivelyAvailable: boolean;
};

export type VenueDetail = VenueRecord & {
  fields: FieldWithAvailability[];
};

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

/** Field is operationally available only when both field and venue are active. */
export function isFieldEffectivelyAvailable(
  fieldActive: boolean,
  venueActive: boolean
): boolean {
  return fieldActive && venueActive;
}
