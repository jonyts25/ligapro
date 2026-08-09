"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import type { PlatformBillingStatus, PlanTier } from "@/lib/platform-billing/types";

export type PlatformBillingActionState = {
  ok: boolean;
  message: string | null;
};

export const initialPlatformBillingActionState: PlatformBillingActionState = {
  ok: false,
  message: null,
};

export type PlatformPlanTierActionState = {
  ok: boolean;
  message: string | null;
};

export const initialPlatformPlanTierActionState: PlatformPlanTierActionState = {
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
  const incomeAmountRaw = String(formData.get("incomeAmount") ?? "").trim();
  const incomeAmount = incomeAmountRaw
    ? Number.parseFloat(incomeAmountRaw)
    : null;

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

  if (
    status === "pagado" &&
    incomeAmount !== null &&
    Number.isFinite(incomeAmount) &&
    incomeAmount > 0
  ) {
    const { error: incomeError } = await supabase.rpc("record_platform_income", {
      p_season_id: seasonId,
      p_amount: incomeAmount,
      ...(reason ? { p_notes: reason } : {}),
    });

    if (incomeError) {
      revalidatePath("/plataforma/facturacion");
      return {
        ok: false,
        message: `Estado actualizado, pero el ingreso no se registró: ${incomeError.message}`,
      };
    }

    revalidatePath("/plataforma/finanzas");
  }

  revalidatePath("/plataforma/facturacion");
  return {
    ok: true,
    message: `Estado actualizado a «${status}».`,
  };
}

export async function setOrganizationPlanTierAction(
  _prev: PlatformPlanTierActionState,
  formData: FormData
): Promise<PlatformPlanTierActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const organizationId = String(formData.get("organizationId") ?? "");
  const planTier = String(formData.get("planTier") ?? "") as PlanTier;

  if (!organizationId) {
    return { ok: false, message: "Organización no válida." };
  }
  if (planTier !== "basico" && planTier !== "premium") {
    return { ok: false, message: "Plan no válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_organization_plan_tier", {
    p_organization_id: organizationId,
    p_plan_tier: planTier,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/facturacion");
  return {
    ok: true,
    message: `Plan actualizado a ${planTier === "premium" ? "Premium" : "Básico"}.`,
  };
}
