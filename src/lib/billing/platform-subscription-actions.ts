"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import {
  parseAddonOverrides,
  type SubscriptionTier,
} from "@/lib/billing/tier-limits";

export type PlatformSubscriptionActionState = {
  ok: boolean;
  message: string | null;
};

export const initialPlatformSubscriptionActionState: PlatformSubscriptionActionState =
  {
    ok: false,
    message: null,
  };

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ error: { message: string } | null }>;
};

function parseNonNegInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

function buildAddonOverrides(formData: FormData): Record<string, number> {
  const overrides: Record<string, number> = {};
  const fields: Array<[string, keyof ReturnType<typeof parseAddonOverrides>]> = [
    ["torneosExtra", "torneos_extra"],
    ["sedesExtra", "sedes_extra"],
    ["canchasExtra", "canchas_extra"],
    ["staffExtra", "usuarios_staff_extra"],
    ["cronicasExtraMes", "cronicas_extra_mes"],
  ];

  for (const [formKey, overrideKey] of fields) {
    const parsed = parseNonNegInt(String(formData.get(formKey) ?? ""));
    if (parsed !== null && parsed > 0) {
      overrides[overrideKey] = parsed;
    }
  }

  return overrides;
}

export async function setOrganizationSubscriptionLimitsAction(
  _prev: PlatformSubscriptionActionState,
  formData: FormData
): Promise<PlatformSubscriptionActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const subscriptionTier = String(
    formData.get("subscriptionTier") ?? ""
  ) as SubscriptionTier;
  const confirmed = String(formData.get("confirmed") ?? "") === "1";

  if (!organizationId) {
    return { ok: false, message: "Organización no válida." };
  }
  if (
    subscriptionTier !== "basico" &&
    subscriptionTier !== "pro" &&
    subscriptionTier !== "premium"
  ) {
    return { ok: false, message: "Tier operativo no válido." };
  }
  if (!confirmed) {
    return { ok: false, message: "Confirma el cambio antes de aplicarlo." };
  }

  const supabase = await createClient();
  const rpc = supabase as unknown as UntypedRpc;

  const { error: tierError } = await rpc.rpc("set_organization_subscription_tier", {
    p_organization_id: organizationId,
    p_subscription_tier: subscriptionTier,
  });

  if (tierError) {
    return { ok: false, message: tierError.message };
  }

  const addonOverrides = buildAddonOverrides(formData);
  const { error: addonError } = await rpc.rpc("set_organization_addon_overrides", {
    p_organization_id: organizationId,
    p_addon_overrides: addonOverrides,
  });

  if (addonError) {
    return { ok: false, message: addonError.message };
  }

  revalidatePath("/plataforma/limites");
  return {
    ok: true,
    message: "Límites operativos actualizados.",
  };
}
