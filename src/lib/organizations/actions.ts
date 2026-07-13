"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import type { OrganizationActionState } from "@/lib/organizations/action-types";
import { normalizeAccentColor } from "@/lib/branding/sanitize-accent";

function validateOrganizationName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 100) {
    return "El nombre debe tener entre 3 y 100 caracteres.";
  }
  return null;
}

export async function createOrganizationAction(
  _prev: OrganizationActionState,
  formData: FormData
): Promise<OrganizationActionState> {
  await requireUser();
  const name = String(formData.get("name") ?? "");
  const useDefaultColor = formData.get("useDefaultColor") === "on";
  const rawColor = String(formData.get("brandColor") ?? "");
  const brandColor = useDefaultColor
    ? null
    : normalizeAccentColor(rawColor || null);

  const nameError = validateOrganizationName(name);
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name, brandColor: useDefaultColor ? null : rawColor },
    };
  }

  if (!useDefaultColor && rawColor.trim() && !brandColor) {
    return {
      ok: false,
      message: "El color debe tener el formato #RRGGBB.",
      fieldErrors: { brandColor: "El color debe tener el formato #RRGGBB." },
      values: { name, brandColor: rawColor },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization_with_owner", {
    p_name: name.trim(),
    ...(brandColor !== null ? { p_brand_color: brandColor } : {}),
  });

  if (error || !data) {
    return {
      ok: false,
      message:
        "No pudimos crear la organización. Verifica tus datos e inténtalo nuevamente.",
      values: { name, brandColor: useDefaultColor ? null : rawColor },
    };
  }

  const organizationId = String(data);
  revalidatePath("/");
  revalidatePath("/onboarding");
  redirect(`/organizaciones/${organizationId}/configuracion?setup=1`);
}

export async function updateOrganizationBrandingAction(
  _prev: OrganizationActionState,
  formData: FormData
): Promise<OrganizationActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const name = String(formData.get("name") ?? "");
  const useDefaultColor = formData.get("useDefaultColor") === "on";
  const rawColor = String(formData.get("brandColor") ?? "");
  const brandColor = useDefaultColor
    ? null
    : normalizeAccentColor(rawColor || null);

  const nameError = validateOrganizationName(name);
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name, brandColor: useDefaultColor ? null : rawColor },
    };
  }

  if (!useDefaultColor && rawColor.trim() && !brandColor) {
    return {
      ok: false,
      message: "El color debe tener el formato #RRGGBB.",
      fieldErrors: { brandColor: "El color debe tener el formato #RRGGBB." },
      values: { name, brandColor: rawColor },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization_branding", {
    p_organization_id: organizationId,
    p_name: name.trim(),
    ...(brandColor !== null ? { p_brand_color: brandColor } : {}),
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos guardar los cambios. Inténtalo nuevamente.",
      values: { name, brandColor: useDefaultColor ? null : rawColor },
    };
  }

  revalidatePath(`/organizaciones/${organizationId}`, "layout");
  revalidatePath(`/organizaciones/${organizationId}/configuracion`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);

  return {
    ok: true,
    message: "Identidad actualizada correctamente.",
    values: { name: name.trim(), brandColor },
  };
}

export async function setOrganizationLogoAction(input: {
  organizationId: string;
  logoPath: string | null;
}): Promise<{ ok: boolean; message: string | null; previousPath: string | null }> {
  const user = await requireUser();
  await requireOrganizationAdmin(user.id, input.organizationId);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("organizations")
    .select("logo_path")
    .eq("id", input.organizationId)
    .maybeSingle();

  const previousPath = current?.logo_path ?? null;

  const { error } = await supabase.rpc("set_organization_logo", {
    p_organization_id: input.organizationId,
    // Generated Args omit NULL; RPC accepts NULL to clear logo.
    p_logo_path: input.logoPath as string,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos actualizar el logo. Inténtalo nuevamente.",
      previousPath,
    };
  }

  revalidatePath(`/organizaciones/${input.organizationId}`, "layout");
  revalidatePath(`/organizaciones/${input.organizationId}/configuracion`);
  revalidatePath(`/organizaciones/${input.organizationId}/inicio`);

  return { ok: true, message: null, previousPath };
}
