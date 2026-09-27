"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { assertCanCreateField } from "@/lib/billing/tier-limits-queries";
import { buildDirectFieldInsertRow } from "@/lib/venues/field-model";
import {
  parseFieldModality,
  parseHourlyRate,
} from "@/lib/venues/field-modality";
import type { VenueActionState } from "@/lib/venues/types";
import { intervalsOverlap } from "@/lib/venues/availability-validation";

function readFieldPricing(formData: FormData) {
  const modalityRaw = String(formData.get("modality") ?? "");
  const hourlyRateRaw = String(formData.get("hourlyRate") ?? "");
  const modality = parseFieldModality(modalityRaw);
  const hourlyRate = parseHourlyRate(hourlyRateRaw);

  const fieldErrors: Record<string, string> = {};
  if (modalityRaw.trim() && !modality) {
    fieldErrors.modality = "Selecciona una modalidad válida.";
  }
  if (hourlyRateRaw.trim() && hourlyRate === null) {
    fieldErrors.hourlyRate = "La tarifa debe ser un número mayor o igual a 0.";
  }

  return { modality, hourlyRate, fieldErrors };
}

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
  const pricing = readFieldPricing(formData);

  const nameError = validateName(name, "nombre de la cancha");
  const fieldErrors = { ...pricing.fieldErrors };
  if (nameError) {
    fieldErrors.name = nameError;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: nameError ?? "Revisa los datos de la cancha.",
      fieldErrors,
      values: {
        name,
        address,
        surfaceType,
        isActive,
        modality: pricing.modality,
        hourlyRate: String(formData.get("hourlyRate") ?? ""),
      },
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
    .insert(
      buildDirectFieldInsertRow({
        organizationId,
        name,
        address,
        surfaceType,
        isActive,
        modality: pricing.modality,
        hourlyRate: pricing.hourlyRate,
      })
    )
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
  const pricing = readFieldPricing(formData);

  const nameError = validateName(name, "nombre de la cancha");
  const fieldErrors = { ...pricing.fieldErrors };
  if (nameError) {
    fieldErrors.name = nameError;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: nameError ?? "Revisa los datos de la cancha.",
      fieldErrors,
      values: {
        name,
        address,
        surfaceType,
        isActive,
        modality: pricing.modality,
        hourlyRate: String(formData.get("hourlyRate") ?? ""),
      },
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
      modality: pricing.modality,
      hourly_rate: pricing.hourlyRate,
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

export async function splitFieldAction(
  _prev: VenueActionState,
  formData: FormData
): Promise<VenueActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const childName1 = String(formData.get("childName1") ?? "");
  const childName2 = String(formData.get("childName2") ?? "");
  const values = { childName1, childName2 };
  const fieldErrors: Record<string, string> = {};

  const name1Error = validateName(childName1, "nombre de la primera mitad");
  const name2Error = validateName(childName2, "nombre de la segunda mitad");
  if (name1Error) fieldErrors.childName1 = name1Error;
  if (name2Error) fieldErrors.childName2 = name2Error;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los nombres de las mitades.",
      fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("split_field_into_children", {
    p_field_id: fieldId,
    p_child_names: [childName1.trim(), childName2.trim()],
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
      values,
    };
  }

  revalidateFieldPaths(organizationId, fieldId);
  redirect(`/organizaciones/${organizationId}/canchas`);
}
