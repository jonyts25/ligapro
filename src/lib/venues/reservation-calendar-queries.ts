import { createClient } from "@/lib/supabase/server";
import { getOrganizationFieldCards } from "@/lib/venues/queries";
import { buildReservationCalendarModel } from "@/lib/venues/reservation-calendar-model";
import type {
  ReservationCalendarEntry,
  ReservationCalendarFieldRow,
} from "@/lib/venues/reservation-calendar-types";
import {
  getWeekRangeBounds,
  resolveWeekStartParam,
} from "@/lib/venues/reservation-calendar-week";
import type { FieldReservationType } from "@/lib/venues/reservation-types";

export type { ReservationCalendarEntry, ReservationCalendarFieldRow };

export type OrganizationReservationCalendar = {
  weekStart: string;
  weekEnd: string;
  fields: ReservationCalendarFieldRow[];
  reservations: ReservationCalendarEntry[];
  model: ReturnType<typeof buildReservationCalendarModel>;
};

function buildMatchHref(
  organizationId: string,
  match:
    | {
        id: string;
        season_id: string;
        seasons: { competition_id: string } | null;
      }
    | null
): string | null {
  if (!match?.seasons?.competition_id) {
    return null;
  }

  return `/organizaciones/${organizationId}/torneos/${match.seasons.competition_id}/temporadas/${match.season_id}/partidos/${match.id}`;
}

function buildDisplayLabel(
  reservationType: string,
  title: string | null,
  matchSeasonName: string | null
): string {
  if (reservationType === "match") {
    return matchSeasonName ? `Partido · ${matchSeasonName}` : "Partido";
  }
  return title?.trim() || "";
}

export async function getOrganizationReservationCalendar(
  organizationId: string,
  weekParam?: string | null
): Promise<OrganizationReservationCalendar> {
  const weekStart = resolveWeekStartParam(weekParam);
  const { rangeStartIso, rangeEndIso } = getWeekRangeBounds(weekStart);
  const supabase = await createClient();

  const fieldCards = await getOrganizationFieldCards(organizationId);
  const fields: ReservationCalendarFieldRow[] = fieldCards.map((field) => ({
    fieldId: field.fieldId,
    fieldName: field.fieldName,
    fieldLabel: field.fieldName,
    parentFieldId: field.parentFieldId,
    parentFieldName: field.parentFieldName,
    childCount: field.childCount,
    isActive: field.isActive,
  }));

  const fieldNameById = new Map(
    fields.map((field) => [field.fieldId, field.fieldName])
  );

  const { data: reservationRows } = await supabase
    .from("field_reservations")
    .select(
      `
      id,
      field_id,
      reservation_type,
      title,
      starts_at,
      ends_at,
      status,
      match_id,
      matches(
        id,
        season_id,
        seasons(name, competition_id)
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .lt("starts_at", rangeEndIso)
    .gt("ends_at", rangeStartIso)
    .order("starts_at");

  const reservations: ReservationCalendarEntry[] = (reservationRows ?? []).map(
    (row) => {
      const match = row.matches as {
        id: string;
        season_id: string;
        seasons: { name: string; competition_id: string } | null;
      } | null;
      const reservationType = row.reservation_type as FieldReservationType;
      const matchSeasonName = match?.seasons?.name ?? null;

      return {
        id: row.id,
        fieldId: row.field_id,
        fieldName: fieldNameById.get(row.field_id) ?? "Cancha",
        reservationType,
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        matchId: row.match_id,
        matchHref: buildMatchHref(organizationId, match),
        canCancel: reservationType !== "match",
        displayLabel: buildDisplayLabel(
          reservationType,
          row.title,
          matchSeasonName
        ),
      };
    }
  );

  const model = buildReservationCalendarModel({
    weekStart,
    fields,
    reservations,
  });

  return {
    weekStart,
    weekEnd: model.weekEnd,
    fields: model.rows.map((row) => row.field),
    reservations,
    model,
  };
}
