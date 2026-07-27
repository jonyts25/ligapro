"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import type { PlatformBillingStatus } from "@/lib/platform-billing/types";
import type { CotizadorParams } from "@/lib/platform-billing/cotizador";

export type PlatformBillingActionState = {
  ok: boolean;
  message: string | null;
};

export const initialPlatformBillingActionState: PlatformBillingActionState = {
  ok: false,
  message: null,
};

export type PlatformPricingDefaultsActionState = {
  ok: boolean;
  message: string | null;
};

export const initialPlatformPricingDefaultsActionState: PlatformPricingDefaultsActionState =
  {
    ok: false,
    message: null,
  };

const ALLOWED: PlatformBillingStatus[] = [
  "pendiente",
  "pagado",
  "vencido",
];

export async function setPlatformBillingStatusAction(
  _prev: PlatformBillingActionState,
  formData: FormData
): Promise<PlatformBillingActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const seasonId = String(formData.get("seasonId") ?? "");
  const status = String(formData.get("status") ?? "") as PlatformBillingStatus;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const confirmed = String(formData.get("confirmed") ?? "") === "1";

  if (!seasonId) {
    return { ok: false, message: "Temporada no válida." };
  }
  if (!ALLOWED.includes(status)) {
    return { ok: false, message: "Estado no válido." };
  }
  if (!confirmed) {
    return {
      ok: false,
      message: "Confirma el cambio antes de aplicarlo.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_platform_billing_status", {
    p_season_id: seasonId,
    p_status: status,
    ...(reason ? { p_reason: reason } : {}),
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/facturacion");
  return {
    ok: true,
    message: `Estado actualizado a «${status}».`,
  };
}

export async function setPlatformPricingDefaultsAction(
  params: CotizadorParams
): Promise<PlatformPricingDefaultsActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const values = [
    params.basePricePerTeam,
    params.durationMultiplierHasta3,
    params.durationMultiplier4To6,
    params.durationMultiplier7To12,
    params.volumeMultiplier1To2,
    params.volumeMultiplier3To5,
    params.volumeMultiplier6Plus,
  ];

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return { ok: false, message: "Valores invalidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_platform_pricing_defaults", {
    p_base_price_per_team: params.basePricePerTeam,
    p_duration_multiplier_hasta_3: params.durationMultiplierHasta3,
    p_duration_multiplier_4_to_6: params.durationMultiplier4To6,
    p_duration_multiplier_7_to_12: params.durationMultiplier7To12,
    p_volume_multiplier_1_to_2: params.volumeMultiplier1To2,
    p_volume_multiplier_3_to_5: params.volumeMultiplier3To5,
    p_volume_multiplier_6_plus: params.volumeMultiplier6Plus,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/cotizador");
  return { ok: true, message: null };
}
