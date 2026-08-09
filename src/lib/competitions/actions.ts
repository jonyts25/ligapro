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
import { getSeasonDetails } from "@/lib/competitions/queries";
import {
  isEditableVisibility,
  isSeasonArchived,
} from "@/lib/competitions/season-visibility";

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

async function revalidateCompetitionPaths(
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
    const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
    revalidatePath(base);
    revalidatePath(`${base}/editar`);
    revalidatePath(`${base}/calendario`);
    revalidatePath(`${base}/posiciones`);
    revalidatePath(`${base}/goleadores`);
    revalidatePath(`${base}/disciplina`);
    revalidatePath(`${base}/bracket`);
    revalidatePath(`${base}/grupos`);

    const supabase = await createClient();
    const { data: season } = await supabase
      .from("seasons")
      .select("slug")
      .eq("id", seasonId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (season?.slug) {
      const publicBase = `/publico/${organizationId}/${season.slug}`;
      revalidatePath(publicBase);
      revalidatePath(`${publicBase}/calendario`);
      revalidatePath(`${publicBase}/posiciones`);
      revalidatePath(`${publicBase}/goleadores`);
      revalidatePath(`${publicBase}/disciplina`);
    }
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

  await revalidateCompetitionPaths(organizationId, data.id);
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

  await revalidateCompetitionPaths(organizationId, competitionId);
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
    groupsAdvancePerGroup: String(formData.get("groupsAdvancePerGroup") ?? ""),
    walkoverEnRetiro: formData.get("walkoverEnRetiro") === "on",
    walkoverRetiroWinnerGoals: String(
      formData.get("walkoverRetiroWinnerGoals") ?? "3"
    ),
    walkoverRetiroLoserGoals: String(
      formData.get("walkoverRetiroLoserGoals") ?? "0"
    ),
    fechaLimiteInscripcion: String(
      formData.get("fechaLimiteInscripcion") ?? ""
    ).trim(),
  };

  const fieldErrors: Record<string, string> = {};
  const nameError = validateName(name, "nombre de la temporada");
  if (nameError) fieldErrors.name = nameError;

  if (!isFormatType(formatType)) {
    fieldErrors.formatType = "Selecciona un formato válido.";
  }
  if (!isVisibility(visibility) || !isEditableVisibility(visibility)) {
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

  let groupsAdvancePerGroup: number | null = null;
  if (formatType === "groups_knockout") {
    const raw = values.groupsAdvancePerGroup.trim();
    if (!raw) {
      fieldErrors.groupsAdvancePerGroup =
        "Indica cuántos equipos clasifican por grupo.";
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        fieldErrors.groupsAdvancePerGroup = "Debe ser un entero mayor que 0.";
      } else {
        groupsAdvancePerGroup = n;
      }
    }
  }

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
      groupsAdvancePerGroup,
      walkoverEnRetiro: values.walkoverEnRetiro,
      walkoverRetiroWinnerGoals: parseNonNegInt(
        values.walkoverRetiroWinnerGoals,
        "Goles walkover ganador"
      ).value ?? 3,
      walkoverRetiroLoserGoals: parseNonNegInt(
        values.walkoverRetiroLoserGoals,
        "Goles walkover perdedor"
      ).value ?? 0,
      fechaLimiteInscripcion: values.fechaLimiteInscripcion || null,
    },
  };
}

async function syncGroupsAdvancePerGroup(
  seasonId: string,
  organizationId: string,
  formatType: SeasonFormatType,
  groupsAdvancePerGroup: number | null
) {
  const supabase = await createClient();
  await supabase
    .from("season_rules")
    .update({
      groups_advance_per_group:
        formatType === "groups_knockout" ? groupsAdvancePerGroup : null,
    })
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId);
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
      p_starts_on: (parsed.startsOn ?? null) as string,
      p_ends_on: (parsed.endsOn ?? null) as string,
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

  await syncGroupsAdvancePerGroup(
    seasonId,
    organizationId,
    parsed.formatType,
    parsed.groupsAdvancePerGroup
  );

  await revalidateCompetitionPaths(organizationId, competitionId, seasonId);
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
    p_starts_on: (parsed.startsOn ?? null) as string,
    p_ends_on: (parsed.endsOn ?? null) as string,
    p_points_win: parsed.pointsWin,
    p_points_draw: parsed.pointsDraw,
    p_points_loss: parsed.pointsLoss,
    p_allow_draws: parsed.allowDraws,
    p_match_duration_minutes: parsed.matchDurationMinutes,
    p_minimum_rest_minutes: parsed.minimumRestMinutes,
    p_yellow_card_limit: parsed.yellowCardLimit,
    p_suspension_matches: parsed.suspensionMatches,
    p_walkover_en_retiro: parsed.walkoverEnRetiro,
    p_walkover_retiro_winner_goals: parsed.walkoverRetiroWinnerGoals,
    p_walkover_retiro_loser_goals: parsed.walkoverRetiroLoserGoals,
    p_fecha_limite_inscripcion: parsed.fechaLimiteInscripcion ?? undefined,
  });

  if (error) {
    return {
      ok: false,
      message: "No pudimos guardar la temporada y las reglas. Inténtalo nuevamente.",
      values,
    };
  }

  await syncGroupsAdvancePerGroup(
    seasonId,
    organizationId,
    parsed.formatType,
    parsed.groupsAdvancePerGroup
  );

  await revalidateCompetitionPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: "Temporada y reglas actualizadas.",
    values,
  };
}

async function updateSeasonVisibilityFromDetail(
  season: NonNullable<Awaited<ReturnType<typeof getSeasonDetails>>>,
  visibility: SeasonVisibility
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const rules = season.rules;
  const { error } = await supabase.rpc("update_season_with_rules", {
    p_season_id: season.id,
    p_name: season.name,
    p_format_type: season.format_type,
    p_visibility: visibility,
    p_starts_on: (season.starts_on ?? null) as string,
    p_ends_on: (season.ends_on ?? null) as string,
    p_points_win: rules.points_win,
    p_points_draw: rules.points_draw,
    p_points_loss: rules.points_loss,
    p_allow_draws: rules.allow_draws,
    p_match_duration_minutes: rules.match_duration_minutes,
    p_minimum_rest_minutes: rules.minimum_rest_minutes,
    p_yellow_card_limit: rules.yellow_card_limit,
    p_suspension_matches: rules.suspension_matches,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Estado actualizado." };
}

export async function archiveSeasonAction(
  _prev: CompetitionActionState,
  formData: FormData
): Promise<CompetitionActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await requireOrganizationAdmin(user.id, organizationId);

  if (String(formData.get("confirmed") ?? "") !== "1") {
    return {
      ok: false,
      message: "Confirma que deseas archivar la temporada.",
    };
  }

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) {
    return { ok: false, message: "No encontramos la temporada." };
  }
  if (isSeasonArchived(season.visibility)) {
    return { ok: false, message: "Esta temporada ya está archivada." };
  }

  const result = await updateSeasonVisibilityFromDetail(season, "archived");
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await revalidateCompetitionPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message:
      "Temporada archivada. Los datos se conservan; la gestión operativa queda deshabilitada en la app.",
  };
}

export async function reactivateSeasonAction(
  _prev: CompetitionActionState,
  formData: FormData
): Promise<CompetitionActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const targetVisibility = String(formData.get("visibility") ?? "private");
  await requireOrganizationAdmin(user.id, organizationId);

  if (String(formData.get("confirmed") ?? "") !== "1") {
    return {
      ok: false,
      message: "Confirma que deseas reactivar la temporada.",
    };
  }

  if (!isEditableVisibility(targetVisibility)) {
    return { ok: false, message: "Selecciona un estado válido para reactivar." };
  }

  const season = await getSeasonDetails(
    organizationId,
    competitionId,
    seasonId
  );
  if (!season) {
    return { ok: false, message: "No encontramos la temporada." };
  }
  if (!isSeasonArchived(season.visibility)) {
    return { ok: false, message: "Esta temporada no está archivada." };
  }

  const result = await updateSeasonVisibilityFromDetail(
    season,
    targetVisibility
  );
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await revalidateCompetitionPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: `Temporada reactivada como «${targetVisibility}».`,
  };
}
