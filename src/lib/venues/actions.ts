"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { assertCanCreateField } from "@/lib/billing/tier-limits-queries";
import type { VenueActionState } from "@/lib/venues/types";
import { intervalsOverlap } from "@/lib/venues/availability-validation";

function validateName(name: string, label = "nombre"): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    return `El ${label} debe tener entre 2 y 100 caracteres.`;
  }
  return null;
}

function revalidateFieldPaths(organizationId: string, fieldId?: string) {
  revalidatePath(`/organizaciones/${organizationId}/canchas`);
  revalidatePath(`/organizaciones/${organizationId}/canchas/disponibilidad`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
  if (fieldId) {
    revalidatePath(`/organizaciones/${organizationId}/canchas/${fieldId}`);
    revalidatePath(
      `/organizaciones/${organizationId}/canchas/${fieldId}/editar`
    );
  }
}

export async function createFieldAction(
  _prev: VenueActionState,
  formData: FormData
): Promise<VenueActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const name = String(formData.get("name") ?? "");
  const addressRaw = String(formData.get("address") ?? "").trim();
  const address = addressRaw.length > 0 ? addressRaw : null;
  const surfaceRaw = String(formData.get("surfaceType") ?? "").trim();
  const surfaceType = surfaceRaw.length > 0 ? surfaceRaw : null;
  const isActive = formData.get("isActive") === "on";

  const nameError = validateName(name, "nombre de la cancha");
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name, address, surfaceType, isActive },
    };
  }

  const tierCheck = await assertCanCreateField(organizationId);
  if (!tierCheck.ok) {
    return {
      ok: false,
      message: tierCheck.message,
      values: { name, address, surfaceType, isActive },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fields")
    .insert({
      organization_id: organizationId,
      name: name.trim(),
      address,
      surface_type: surfaceType,
      is_active: isActive,
      venue_id: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: "No pudimos crear la cancha. Inténtalo nuevamente.",
      values: { name, address, surfaceType, isActive },
    };
  }

  revalidateFieldPaths(organizationId, data.id);
  redirect(`/organizaciones/${organizationId}/canchas/${data.id}`);
}

export async function updateFieldAction(
  _prev: VenueActionState,
  formData: FormData
): Promise<VenueActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const name = String(formData.get("name") ?? "");
  const addressRaw = String(formData.get("address") ?? "").trim();
  const address = addressRaw.length > 0 ? addressRaw : null;
  const surfaceRaw = String(formData.get("surfaceType") ?? "").trim();
  const surfaceType = surfaceRaw.length > 0 ? surfaceRaw : null;
  const isActive = formData.get("isActive") === "on";

  const nameError = validateName(name, "nombre de la cancha");
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name, address, surfaceType, isActive },
    };
  }

  const supabase = await createClient();
  const { data: field } = await supabase
    .from("fields")
    .select("id")
    .eq("id", fieldId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!field) {
    return { ok: false, message: "No encontramos la cancha." };
  }

  const { error } = await supabase
    .from("fields")
    .update({
      name: name.trim(),
      address,
      surface_type: surfaceType,
      is_active: isActive,
    })
    .eq("id", fieldId)
    .eq("organization_id", organizationId);

  if (error) {
    return {
      ok: false,
      message: "No pudimos guardar la cancha. Inténtalo nuevamente.",
      values: { name, address, surfaceType, isActive },
    };
  }

  revalidateFieldPaths(organizationId, fieldId);
  return {
    ok: true,
    message: "Cancha actualizada correctamente.",
    values: { name: name.trim(), address, surfaceType, isActive },
  };
}

export async function replaceFieldAvailabilityAction(input: {
  organizationId: string;
  fieldId: string;
  intervals: Array<{
    day_of_week: number;
    starts_at: string;
    ends_at: string;
  }>;
}): Promise<{ ok: boolean; message: string | null }> {
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, input.organizationId);

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const interval of input.intervals) {
    if (
      !Number.isInteger(interval.day_of_week) ||
      interval.day_of_week < 0 ||
      interval.day_of_week > 6
    ) {
      return { ok: false, message: "Hay un día inválido en la disponibilidad." };
    }
    if (!timeRe.test(interval.starts_at) || !timeRe.test(interval.ends_at)) {
      return {
        ok: false,
        message: "Las horas deben tener el formato HH:MM.",
      };
    }
    if (interval.ends_at <= interval.starts_at) {
      return {
        ok: false,
        message: "La hora final debe ser posterior a la inicial.",
      };
    }
  }

  for (let i = 0; i < input.intervals.length; i++) {
    for (let j = i + 1; j < input.intervals.length; j++) {
      const a = input.intervals[i];
      const b = input.intervals[j];
      if (
        a.day_of_week === b.day_of_week &&
        intervalsOverlap(a.starts_at, a.ends_at, b.starts_at, b.ends_at)
      ) {
        return {
          ok: false,
          message: "Hay intervalos solapados o duplicados el mismo día.",
        };
      }
    }
  }

  const supabase = await createClient();
  const { data: field } = await supabase
    .from("fields")
    .select("id")
    .eq("id", input.fieldId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (!field) {
    return { ok: false, message: "No encontramos la cancha." };
  }

  const { error } = await supabase.rpc("replace_field_availability", {
    p_field_id: input.fieldId,
    p_intervals: input.intervals,
  });

  if (error) {
    return {
      ok: false,
      message:
        "No pudimos guardar la disponibilidad. Revisa los horarios e inténtalo nuevamente.",
    };
  }

  revalidateFieldPaths(input.organizationId, input.fieldId);
  return { ok: true, message: "Disponibilidad actualizada." };
}

const deprecatedVenuesMessage =
  "El flujo de sedes fue reemplazado por canchas directas. Usa el menú Canchas.";

/** @deprecated Use createFieldAction on /canchas/nueva */
export async function createVenueAction(): Promise<VenueActionState> {
  return { ok: false, message: deprecatedVenuesMessage };
}

/** @deprecated Use updateFieldAction on /canchas/[fieldId]/editar */
export async function updateVenueAction(): Promise<VenueActionState> {
  return { ok: false, message: deprecatedVenuesMessage };
}
