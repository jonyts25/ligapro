"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { isPlatformStaff } from "@/lib/platform-billing/queries";
import type {
  ModalityPresetActionState,
  TournamentModality,
} from "@/lib/competitions/tournament-type-presets";

function parseIntField(
  formData: FormData,
  name: string,
  label: string
): { value?: number; error?: string } {
  const raw = String(formData.get(name) ?? "").trim();
  if (!/^-?\d+$/.test(raw)) {
    return { error: `${label} debe ser un entero.` };
  }
  return { value: Number(raw) };
}

function parseOptionalIntField(
  formData: FormData,
  name: string
): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export async function saveTournamentTypePresetAction(
  _prev: ModalityPresetActionState,
  formData: FormData
): Promise<ModalityPresetActionState> {
  const user = await requireUser();
  if (!(await isPlatformStaff(user.id))) {
    return { ok: false, message: "No autorizado." };
  }

  const modality = String(formData.get("modality") ?? "") as TournamentModality;
  const label = String(formData.get("label") ?? "").trim();

  const playersOnField = parseIntField(formData, "playersOnField", "Jugadores");
  const halvesCount = parseIntField(formData, "halvesCount", "Tiempos");
  const matchDurationMinutes = parseIntField(
    formData,
    "matchDurationMinutes",
    "Duración"
  );
  const pointsWin = parseIntField(formData, "pointsWin", "Puntos victoria");
  const pointsDraw = parseIntField(formData, "pointsDraw", "Puntos empate");
  const pointsLoss = parseIntField(formData, "pointsLoss", "Puntos derrota");
  const minimumRestMinutes = parseIntField(
    formData,
    "minimumRestMinutes",
    "Descanso mínimo"
  );
  const yellowCardLimit = parseIntField(
    formData,
    "yellowCardLimit",
    "Límite amarillas"
  );
  const suspensionMatches = parseIntField(
    formData,
    "suspensionMatches",
    "Suspensión"
  );

  const fields = [
    playersOnField,
    halvesCount,
    matchDurationMinutes,
    pointsWin,
    pointsDraw,
    pointsLoss,
    minimumRestMinutes,
    yellowCardLimit,
    suspensionMatches,
  ];
  if (fields.some((field) => field.error)) {
    return {
      ok: false,
      message: fields.find((field) => field.error)?.error ?? "Valores inválidos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tournament_type_preset", {
    p_modality: modality,
    p_label: label,
    p_players_on_field: playersOnField.value!,
    p_halves_count: halvesCount.value!,
    p_match_duration_minutes: matchDurationMinutes.value!,
    p_points_win: pointsWin.value!,
    p_points_draw: pointsDraw.value!,
    p_points_loss: pointsLoss.value!,
    p_allow_draws: formData.get("allowDraws") === "on",
    p_minimum_rest_minutes: minimumRestMinutes.value!,
    p_yellow_card_limit: yellowCardLimit.value!,
    p_suspension_matches: suspensionMatches.value!,
    p_min_roster_size: parseOptionalIntField(formData, "minRosterSize"),
    p_max_roster_size: parseOptionalIntField(formData, "maxRosterSize"),
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/plataforma/modalidades");
  return { ok: true, message: "Modalidad guardada." };
}
