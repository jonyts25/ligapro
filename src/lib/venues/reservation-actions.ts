"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  validateCancelFieldReservation,
  validateCreateFieldReservationInput,
} from "@/lib/venues/reservation-validation";
import type { ReservationActionState } from "@/lib/venues/types";

function revalidateReservationCalendarPaths(organizationId: string) {
  revalidatePath(`/organizaciones/${organizationId}/canchas/calendario`);
  revalidatePath(`/organizaciones/${organizationId}/canchas`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
}

function readCreateFormValues(formData: FormData): Record<string, string> {
  return {
    fieldId: String(formData.get("fieldId") ?? ""),
    reservationType: String(formData.get("reservationType") ?? ""),
    date: String(formData.get("date") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    title: String(formData.get("title") ?? ""),
  };
}

export async function createFieldReservationAction(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const values = readCreateFormValues(formData);

  await requireOrganizationAdmin(user.id, organizationId);

  const validation = validateCreateFieldReservationInput({
    organizationId,
    fieldId: values.fieldId,
    reservationType: values.reservationType,
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
    title: values.title,
  });

  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
      fieldErrors: validation.fieldErrors,
      values,
    };
  }

  const supabase = await createClient();

  const { data: field } = await supabase
    .from("fields")
    .select("id, is_active")
    .eq("id", values.fieldId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!field) {
    return {
      ok: false,
      message: "Cancha no encontrada.",
      values,
    };
  }

  if (!field.is_active) {
    return {
      ok: false,
      message: "Esta cancha está inactiva.",
      values,
    };
  }

  const { error } = await supabase.from("field_reservations").insert({
    organization_id: organizationId,
    field_id: values.fieldId,
    reservation_type: validation.reservationType,
    match_id: null,
    starts_at: validation.startsAt,
    ends_at: validation.endsAt,
    title: validation.title,
    status: "confirmed",
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
      values,
    };
  }

  revalidateReservationCalendarPaths(organizationId);

  return {
    ok: true,
    message: "Reserva creada.",
  };
}

export async function cancelFieldReservationAction(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  if (!reservationId) {
    return { ok: false, message: "Reserva no especificada." };
  }

  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("field_reservations")
    .select("id, reservation_type, status")
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const validation = validateCancelFieldReservation(reservation);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const { error } = await supabase
    .from("field_reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .eq("status", "confirmed");

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateReservationCalendarPaths(organizationId);

  return { ok: true, message: "Reserva cancelada." };
}
