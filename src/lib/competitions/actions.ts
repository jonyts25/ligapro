"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import {
  SEASON_FORMAT_OPTIONS,
  SEASON_VISIBILITY_OPTIONS,
  slugifySeasonName,
  type CompetitionActionState,
  type SeasonFormatType,
  type SeasonVisibility,
} from "@/lib/competitions/types";

function validateName(name: string, label: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    return `El ${label} debe tener entre 2 y 100 caracteres.`;
  }
  return null;
}

function parseNonNegInt(raw: string, label: string): { value?: number; error?: string } {
  if (!/^-?\d+$/.test(raw.trim())) {
    return { error: `${label} debe ser un número entero.` };
  }
  const value = Number(raw);
  if (value < 0) return { error: `${label} no puede ser negativo.` };
  return { value };
}

function parsePositiveInt(raw: string, label: string): { value?: number; error?: string } {
  const parsed = parseNonNegInt(raw, label);
  if (parsed.error) return parsed;
  if ((parsed.value ?? 0) <= 0) {
    return { error: `${label} debe ser mayor que cero.` };
  }
  return parsed;
}

function isFormatType(value: string): value is SeasonFormatType {
  return SEASON_FORMAT_OPTIONS.some((o) => o.value === value);
}

function isVisibility(value: string): value is SeasonVisibility {
  return SEASON_VISIBILITY_OPTIONS.some((o) => o.value === value);
}

function revalidateCompetitionPaths(
  organizationId: string,
  competitionId?: string,
  seasonId?: string
) {
  revalidatePath(`/organizaciones/${organizationId}/torneos`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
  if (competitionId) {
    revalidatePath(`/organizaciones/${organizationId}/torneos/${competitionId}`);
    revalidatePath(
      `/organizaciones/${organizationId}/torneos/${competitionId}/editar`
    );
  }
  if (competitionId && seasonId) {
    revalidatePath(
      `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`
    );
    revalidatePath(
      `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/editar`
    );
  }
}

export async function createCompetitionAction(
  _prev: CompetitionActionState,
  formData: FormData
): Promise<CompetitionActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const name = String(formData.get("name") ?? "");
  const nameError = validateName(name, "nombre del torneo");
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitions")
    .insert({
      organization_id: organizationId,
      name: name.trim(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: "No pudimos crear el torneo. Inténtalo nuevamente.",
      values: { name },
    };
  }

  revalidateCompetitionPaths(organizationId, data.id);
  redirect(`/organizaciones/${organizationId}/torneos/${data.id}`);
}

export async function updateCompetitionAction(
  _prev: CompetitionActionState,
  formData: FormData
): Promise<CompetitionActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const name = String(formData.get("name") ?? "");
  const nameError = validateName(name, "nombre del torneo");
  if (nameError) {
    return {
      ok: false,
      message: nameError,
      fieldErrors: { name: nameError },
      values: { name },
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("competitions")
    .select("id")
    .eq("id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, message: "No encontramos el torneo." };
  }

  const { error } = await supabase
    .from("competitions")
    .update({ name: name.trim() })
    .eq("id", competitionId)
    .eq("organization_id", organizationId);

  if (error) {
    return {
      ok: false,
      message: "No pudimos guardar el torneo. Inténtalo nuevamente.",
      values: { name },
    };
  }

  revalidateCompetitionPaths(organizationId, competitionId);
  return {
    ok: true,
    message: "Torneo actualizado correctamente.",
    values: { name: name.trim() },
  };
}

function parseSeasonForm(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const formatType = String(formData.get("formatType") ?? "");
  const visibility = String(formData.get("visibility") ?? "draft");
  const startsOnRaw = String(formData.get("startsOn") ?? "").trim();
  const endsOnRaw = String(formData.get("endsOn") ?? "").trim();
  const startsOn = startsOnRaw || null;
  const endsOn = endsOnRaw || null;

  const values = {
    name,
    formatType,
    visibility,
    startsOn,
    endsOn,
    pointsWin: String(formData.get("pointsWin") ?? "3"),
    pointsDraw: String(formData.get("pointsDraw") ?? "1"),
    pointsLoss: String(formData.get("pointsLoss") ?? "0"),
    allowDraws: formData.get("allowDraws") === "on",
    matchDurationMinutes: String(formData.get("matchDurationMinutes") ?? "90"),
    minimumRestMinutes: String(formData.get("minimumRestMinutes") ?? "0"),
    yellowCardLimit: String(formData.get("yellowCardLimit") ?? "5"),
    suspensionMatches: String(formData.get("suspensionMatches") ?? "1"),
  };

  const fieldErrors: Record<string, string> = {};
  const nameError = validateName(name, "nombre de la temporada");
  if (nameError) fieldErrors.name = nameError;

  if (!isFormatType(formatType)) {
    fieldErrors.formatType = "Selecciona un formato válido.";
  }
  if (!isVisibility(visibility)) {
    fieldErrors.visibility = "Selecciona un estado válido.";
  }
  if (startsOn && endsOn && endsOn < startsOn) {
    fieldErrors.endsOn = "La fecha de fin no puede ser anterior al inicio.";
  }

  const pointsWin = parseNonNegInt(values.pointsWin, "Puntos por victoria");
  const pointsDraw = parseNonNegInt(values.pointsDraw, "Puntos por empate");
  const pointsLoss = parseNonNegInt(values.pointsLoss, "Puntos por derrota");
  const matchDuration = parsePositiveInt(
    values.matchDurationMinutes,
    "Duración del partido"
  );
  const restMinutes = parseNonNegInt(
    values.minimumRestMinutes,
    "Descanso mínimo"
  );
  const yellowLimit = parsePositiveInt(
    values.yellowCardLimit,
    "Límite de amarillas"
  );
  const suspension = parsePositiveInt(
    values.suspensionMatches,
    "Partidos de suspensión"
  );

  if (pointsWin.error) fieldErrors.pointsWin = pointsWin.error;
  if (pointsDraw.error) fieldErrors.pointsDraw = pointsDraw.error;
  if (pointsLoss.error) fieldErrors.pointsLoss = pointsLoss.error;
  if (matchDuration.error) fieldErrors.matchDurationMinutes = matchDuration.error;
  if (restMinutes.error) fieldErrors.minimumRestMinutes = restMinutes.error;
  if (yellowLimit.error) fieldErrors.yellowCardLimit = yellowLimit.error;
  if (suspension.error) fieldErrors.suspensionMatches = suspension.error;

  if (
    pointsWin.value != null &&
    pointsDraw.value != null &&
    pointsLoss.value != null &&
    !(pointsWin.value >= pointsDraw.value && pointsDraw.value >= pointsLoss.value)
  ) {
    fieldErrors.pointsWin =
      "Los puntos deben cumplir: victoria ≥ empate ≥ derrota.";
  }

  return {
    values,
    fieldErrors,
    parsed: {
      name: name.trim(),
      formatType: formatType as SeasonFormatType,
      visibility: visibility as SeasonVisibility,
      startsOn,
      endsOn,
      pointsWin: pointsWin.value ?? 3,
      pointsDraw: pointsDraw.value ?? 1,
      pointsLoss: pointsLoss.value ?? 0,
      allowDraws: values.allowDraws,
      matchDurationMinutes: matchDuration.value ?? 90,
      minimumRestMinutes: restMinutes.value ?? 0,
      yellowCardLimit: yellowLimit.value ?? 5,
      suspensionMatches: suspension.value ?? 1,
    },
  };
}

export async function createSeasonAction(
  _prev: CompetitionActionState,
  formData: FormData
): Promise<CompetitionActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const { values, fieldErrors, parsed } = parseSeasonForm(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos de la temporada y las reglas.",
      fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!competition) {
    return { ok: false, message: "No encontramos el torneo." };
  }

  const { data: seasonId, error } = await supabase.rpc(
    "create_season_with_rules",
    {
      p_competition_id: competitionId,
      p_name: parsed.name,
      p_slug: slugifySeasonName(parsed.name),
      p_format_type: parsed.formatType,
      p_visibility: parsed.visibility,
      p_starts_on: parsed.startsOn,
      p_ends_on: parsed.endsOn,
      p_points_win: parsed.pointsWin,
      p_points_draw: parsed.pointsDraw,
      p_points_loss: parsed.pointsLoss,
      p_allow_draws: parsed.allowDraws,
      p_match_duration_minutes: parsed.matchDurationMinutes,
      p_minimum_rest_minutes: parsed.minimumRestMinutes,
      p_yellow_card_limit: parsed.yellowCardLimit,
      p_suspension_matches: parsed.suspensionMatches,
    }
  );

  if (error || !seasonId) {
    return {
      ok: false,
      message: "No pudimos crear la temporada. Inténtalo nuevamente.",
      values,
    };
  }

  revalidateCompetitionPaths(organizationId, competitionId, seasonId);
  redirect(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`
  );
}

export async function updateSeasonAction(
  _prev: CompetitionActionState,
  formData: FormData
): Promise<CompetitionActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  const { values, fieldErrors, parsed } = parseSeasonForm(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Revisa los datos de la temporada y las reglas.",
      fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("competition_id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!season) {
    return { ok: false, message: "No encontramos la temporada." };
  }

  const { error } = await supabase.rpc("update_season_with_rules", {
    p_season_id: seasonId,
    p_name: parsed.name,
    p_format_type: parsed.formatType,
    p_visibility: parsed.visibility,
    p_starts_on: parsed.startsOn,
    p_ends_on: parsed.endsOn,
    p_points_win: parsed.pointsWin,
    p_points_draw: parsed.pointsDraw,
    p_points_loss: parsed.pointsLoss,
    p_allow_draws: parsed.allowDraws,
    p_match_duration_minutes: parsed.matchDurationMinutes,
    p_minimum_rest_minutes: parsed.minimumRestMinutes,
    p_yellow_card_limit: parsed.yellowCardLimit,
    p_suspension_matches: parsed.suspensionMatches,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos guardar la temporada y las reglas. Inténtalo nuevamente.",
      values,
    };
  }

  revalidateCompetitionPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: "Temporada y reglas actualizadas.",
    values,
  };
}
