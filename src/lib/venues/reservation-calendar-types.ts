import type { FieldReservationType } from "@/lib/venues/reservation-types";

export type ReservationCalendarFieldRow = {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  parentFieldId: string | null;
  parentFieldName: string | null;
  childCount: number;
  isActive: boolean;
};

export type ReservationCalendarEntry = {
  id: string;
  fieldId: string;
  fieldName: string;
  reservationType: FieldReservationType;
  title: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  matchId: string | null;
  matchHref: string | null;
  canCancel: boolean;
  displayLabel: string;
};
