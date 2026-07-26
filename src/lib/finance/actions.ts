"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  CHARGE_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  type ChargeType,
  type FinanceActionState,
  type PaymentMethod,
} from "@/lib/finance/types";

async function revalidateFinancePaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  revalidatePath(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/finanzas`
  );
}

function isChargeType(value: string): value is ChargeType {
  return CHARGE_TYPE_OPTIONS.some((o) => o.value === value);
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_OPTIONS.some((o) => o.value === value);
}

export async function addTeamChargesAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const chargeType = String(formData.get("chargeType") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const seasonTeamIds = formData.getAll("seasonTeamIds").map(String);

  const fieldErrors: Record<string, string> = {};
  if (!isChargeType(chargeType)) {
    fieldErrors.chargeType = "Selecciona un tipo de cargo.";
  }
  if (!amountRaw || Number.isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
    fieldErrors.amount = "Indica un monto mayor a cero.";
  }
  if (seasonTeamIds.length === 0) {
    fieldErrors.seasonTeamIds = "Selecciona al menos un equipo.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos del cargo.",
      fieldErrors,
      values: {
        chargeType,
        description,
        amount: amountRaw,
        dueDate: dueDateRaw || null,
        seasonTeamIds,
      },
    };
  }

  const supabase = await createClient();
  const amount = Number(amountRaw);
  const dueDate = dueDateRaw || null;

  for (const seasonTeamId of seasonTeamIds) {
    const { error } = await supabase.from("team_charges").insert({
      organization_id: organizationId,
      season_team_id: seasonTeamId,
      charge_type: chargeType,
      description: description || null,
      amount,
      due_date: dueDate,
      created_by_profile_id: user.id,
    });

    if (error) {
      return {
        ok: false,
        message: "No pudimos registrar uno o más cargos. Inténtalo nuevamente.",
        fieldErrors,
      };
    }
  }

  await revalidateFinancePaths(organizationId, competitionId, seasonId);
  const count = seasonTeamIds.length;
  return {
    ok: true,
    message:
      count === 1
        ? "Cargo registrado."
        : `${count} cargos registrados (uno por equipo).`,
  };
}

export async function markTeamPaidAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const paymentMethod = String(formData.get("paymentMethod") ?? "cash");
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!seasonTeamId) {
    return { ok: false, message: "Equipo no válido." };
  }
  if (!isPaymentMethod(paymentMethod)) {
    return { ok: false, message: "Método de pago no válido." };
  }
  if (!amountRaw || Number.isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
    return { ok: false, message: "El saldo pendiente debe ser mayor a cero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("team_payments").insert({
    organization_id: organizationId,
    season_team_id: seasonTeamId,
    amount: Number(amountRaw),
    payment_method: paymentMethod,
    recorded_by_profile_id: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos registrar el pago. Inténtalo nuevamente.",
    };
  }

  await revalidateFinancePaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Pago registrado por el saldo pendiente." };
}

export async function voidTeamChargeAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const chargeId = String(formData.get("chargeId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return {
      ok: false,
      message: "El motivo de anulación es obligatorio.",
      fieldErrors: { reason: "Indica el motivo." },
    };
  }
  if (!chargeId) {
    return { ok: false, message: "Cargo no válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_team_charge", {
    p_charge_id: chargeId,
    p_reason: reason,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos anular el cargo. Inténtalo nuevamente.",
    };
  }

  await revalidateFinancePaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Cargo anulado." };
}

export async function voidTeamPaymentAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return {
      ok: false,
      message: "El motivo de anulación es obligatorio.",
      fieldErrors: { reason: "Indica el motivo." },
    };
  }
  if (!paymentId) {
    return { ok: false, message: "Pago no válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_team_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos anular el pago. Inténtalo nuevamente.",
    };
  }

  await revalidateFinancePaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Pago anulado." };
}
