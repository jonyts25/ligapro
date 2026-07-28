"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import type { PlatformExpenseCategory } from "@/lib/platform-finance/types";

export type PlatformFinanceActionState = {
  ok: boolean;
  message: string | null;
};

export const initialPlatformFinanceActionState: PlatformFinanceActionState = {
  ok: false,
  message: null,
};

const EXPENSE_CATEGORIES: PlatformExpenseCategory[] = [
  "hosting",
  "herramientas",
  "marketing",
  "otro",
];

function parseAmount(raw: string): number | null {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function recordPlatformIncomeAction(
  _prev: PlatformFinanceActionState,
  formData: FormData
): Promise<PlatformFinanceActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (amount === null) {
    return { ok: false, message: "Monto invalido." };
  }

  const seasonIdRaw = String(formData.get("seasonId") ?? "").trim();
  const seasonId = seasonIdRaw.length > 0 ? seasonIdRaw : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const year = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const month = Number.parseInt(String(formData.get("month") ?? ""), 10);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_platform_income", {
    p_season_id: seasonId,
    p_amount: amount,
    ...(notes ? { p_notes: notes } : {}),
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/finanzas");
  if (Number.isFinite(year) && Number.isFinite(month)) {
    revalidatePath(`/plataforma/finanzas?anio=${year}&mes=${month}`);
  }
  return { ok: true, message: "Ingreso registrado." };
}

export async function recordPlatformExpenseAction(
  _prev: PlatformFinanceActionState,
  formData: FormData
): Promise<PlatformFinanceActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const category = String(formData.get("category") ?? "") as PlatformExpenseCategory;
  if (amount === null) {
    return { ok: false, message: "Monto invalido." };
  }
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return { ok: false, message: "Categoria invalida." };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const year = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const month = Number.parseInt(String(formData.get("month") ?? ""), 10);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_platform_expense", {
    p_category: category,
    p_amount: amount,
    ...(notes ? { p_notes: notes } : {}),
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/finanzas");
  if (Number.isFinite(year) && Number.isFinite(month)) {
    revalidatePath(`/plataforma/finanzas?anio=${year}&mes=${month}`);
  }
  return { ok: true, message: "Egreso registrado." };
}

export async function voidPlatformIncomeAction(
  _prev: PlatformFinanceActionState,
  formData: FormData
): Promise<PlatformFinanceActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const entryId = String(formData.get("entryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const year = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const month = Number.parseInt(String(formData.get("month") ?? ""), 10);

  if (!entryId) {
    return { ok: false, message: "Registro no valido." };
  }
  if (!reason) {
    return { ok: false, message: "El motivo de anulacion es obligatorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_platform_income_entry", {
    p_entry_id: entryId,
    p_reason: reason,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/finanzas");
  if (Number.isFinite(year) && Number.isFinite(month)) {
    revalidatePath(`/plataforma/finanzas?anio=${year}&mes=${month}`);
  }
  return { ok: true, message: "Ingreso anulado." };
}

export async function voidPlatformExpenseAction(
  _prev: PlatformFinanceActionState,
  formData: FormData
): Promise<PlatformFinanceActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const entryId = String(formData.get("entryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const year = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const month = Number.parseInt(String(formData.get("month") ?? ""), 10);

  if (!entryId) {
    return { ok: false, message: "Registro no valido." };
  }
  if (!reason) {
    return { ok: false, message: "El motivo de anulacion es obligatorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_platform_expense_entry", {
    p_entry_id: entryId,
    p_reason: reason,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/finanzas");
  if (Number.isFinite(year) && Number.isFinite(month)) {
    revalidatePath(`/plataforma/finanzas?anio=${year}&mes=${month}`);
  }
  return { ok: true, message: "Egreso anulado." };
}
