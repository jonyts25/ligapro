"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import {
  MATCH_EVENT_TYPE_OPTIONS,
  MATCH_OFFICIAL_ROLE_OPTIONS,
  MATCH_STATUS_OPTIONS,
  SEASON_ROLE_OPTIONS,
  allowedStatusTransitions,
  type CaptureActionState,
  type MatchEventType,
  type MatchOfficialRole,
  type MatchStatusValue,
  type SeasonRoleValue,
} from "@/lib/matches/types";

function revalidateMatchPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId?: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(base);
  revalidatePath(`${base}/calendario`);
  revalidatePath(`${base}/oficiales`);
  revalidatePath(`/organizaciones/${organizationId}/inicio`);
  revalidatePath(`/organizaciones/${organizationId}/partidos`);
  if (matchId) {
    revalidatePath(`${base}/partidos/${matchId}`);
    revalidatePath(`${base}/partidos/${matchId}/captura`);
    revalidatePath(`${base}/partidos/${matchId}/programar`);
  }
}

function isSeasonRole(value: string): value is SeasonRoleValue {
  return SEASON_ROLE_OPTIONS.some((o) => o.value === value);
}

function isOfficialRole(value: string): value is MatchOfficialRole {
  return MATCH_OFFICIAL_ROLE_OPTIONS.some((o) => o.value === value);
}

function isEventType(value: string): value is MatchEventType {
  return MATCH_EVENT_TYPE_OPTIONS.some((o) => o.value === value);
}

function isMatchStatus(value: string): value is MatchStatusValue {
  return MATCH_STATUS_OPTIONS.some((o) => o.value === value);
}

function humanError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("unique") || lower.includes("duplicate")) {
    return "Esa asignación ya existe.";
  }
  if (lower.includes("not authorized") || lower.includes("row-level")) {
    return "No tienes permiso para esta acción.";
  }
  if (lower.includes("organization_members")) {
    return "El usuario debe ser miembro vigente de la organización.";
  }
  return message || "No se pudo completar la operación.";
}

export async function assignSeasonRoleAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const role = String(formData.get("role") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  if (!profileId || !isSeasonRole(role)) {
    return { ok: false, message: "Selecciona un miembro y un rol válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("season_roles").insert({
    organization_id: organizationId,
    season_id: seasonId,
    profile_id: profileId,
    role,
  });

  if (error) {
    return { ok: false, message: humanError(error.message) };
  }

  revalidateMatchPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Rol de temporada asignado." };
}

export async function removeSeasonRoleAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const seasonRoleId = String(formData.get("seasonRoleId") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("season_roles")
    .delete()
    .eq("id", seasonRoleId)
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  if (error) {
    return { ok: false, message: humanError(error.message) };
  }

  revalidateMatchPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: "Rol retirado." };
}

export async function assignMatchOfficialAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const role = String(formData.get("role") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  if (!profileId || !isOfficialRole(role)) {
    return { ok: false, message: "Selecciona un miembro y un rol válido." };
  }

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("organization_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!member) {
    return {
      ok: false,
      message: "El perfil debe ser miembro vigente de la organización.",
    };
  }

  if (role === "referee" || role === "delegate") {
    const { data: seasonRole } = await supabase
      .from("season_roles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("season_id", seasonId)
      .eq("profile_id", profileId)
      .eq("role", role)
      .maybeSingle();

    if (!seasonRole) {
      return {
        ok: false,
        message: `Asigna primero el rol de temporada «${role}» a esta persona.`,
      };
    }
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, season_id")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (!match) {
    return { ok: false, message: "Partido no encontrado." };
  }

  const { error } = await supabase.from("match_officials").insert({
    organization_id: organizationId,
    match_id: matchId,
    profile_id: profileId,
    role,
    status: "assigned",
  });

  if (error) {
    return { ok: false, message: humanError(error.message) };
  }

  revalidateMatchPaths(organizationId, competitionId, seasonId, matchId);
  return { ok: true, message: "Oficial asignado." };
}

export async function confirmMatchOfficialAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const matchOfficialId = String(formData.get("matchOfficialId") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("match_officials")
    .update({ status: "confirmed" })
    .eq("id", matchOfficialId)
    .eq("organization_id", organizationId)
    .eq("match_id", matchId);

  if (error) {
    return { ok: false, message: humanError(error.message) };
  }

  revalidateMatchPaths(organizationId, competitionId, seasonId, matchId);
  return { ok: true, message: "Asignación confirmada." };
}

export async function removeMatchOfficialAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const matchOfficialId = String(formData.get("matchOfficialId") ?? "");

  await requireOrganizationAdmin(user.id, organizationId);

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!match) {
    return { ok: false, message: "Partido no encontrado." };
  }
  if (match.status === "finished" || match.status === "in_progress") {
    return {
      ok: false,
      message: "No se pueden retirar oficiales de un partido en curso o finalizado.",
    };
  }

  const { error } = await supabase
    .from("match_officials")
    .delete()
    .eq("id", matchOfficialId)
    .eq("organization_id", organizationId)
    .eq("match_id", matchId);

  if (error) {
    return { ok: false, message: humanError(error.message) };
  }

  revalidateMatchPaths(organizationId, competitionId, seasonId, matchId);
  return { ok: true, message: "Oficial retirado." };
}

export async function updateMatchResultAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const homeRaw = String(formData.get("homeScore") ?? "").trim();
  const awayRaw = String(formData.get("awayScore") ?? "").trim();

  const membership = await requireOrganizationMembership(
    user.id,
    organizationId
  );

  if (!isMatchStatus(statusRaw)) {
    return { ok: false, message: "Estado de partido inválido." };
  }

  if (!/^\d+$/.test(homeRaw) || !/^\d+$/.test(awayRaw)) {
    return {
      ok: false,
      message: "Los marcadores deben ser enteros no negativos.",
      values: { status: statusRaw, homeScore: homeRaw, awayScore: awayRaw },
    };
  }

  const homeScore = Number(homeRaw);
  const awayScore = Number(awayRaw);

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, status, season_id, organization_id")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (!match) {
    return { ok: false, message: "Partido no encontrado." };
  }

  const current = match.status as MatchStatusValue;
  if (!allowedStatusTransitions(current).includes(statusRaw)) {
    return {
      ok: false,
      message: `No se puede pasar de «${current}» a «${statusRaw}».`,
    };
  }

  // Extra gate: tournament_admin/org admin only (RPC enforces too)
  const isOrgAdmin =
    membership.role === "organization_owner" ||
    membership.role === "organization_admin";
  if (!isOrgAdmin) {
    const { data: role } = await supabase
      .from("season_roles")
      .select("id")
      .eq("season_id", seasonId)
      .eq("profile_id", user.id)
      .eq("role", "tournament_admin")
      .maybeSingle();
    if (!role) {
      return {
        ok: false,
        message: "Solo owner/admin o admin de torneo pueden actualizar el marcador.",
      };
    }
  }

  const { error } = await supabase.rpc("update_match_result", {
    p_match_id: matchId,
    p_status: statusRaw,
    p_home_score: homeScore,
    p_away_score: awayScore,
  });

  if (error) {
    return { ok: false, message: humanError(error.message) };
  }

  revalidateMatchPaths(organizationId, competitionId, seasonId, matchId);
  return { ok: true, message: "Marcador y estado actualizados." };
}

export async function recordMatchEventAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const eventType = String(formData.get("eventType") ?? "");
  const seasonTeamPlayerId = String(formData.get("seasonTeamPlayerId") ?? "");
  const minuteRaw = String(formData.get("minute") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await requireOrganizationMembership(user.id, organizationId);

  if (!isEventType(eventType)) {
    return { ok: false, message: "Tipo de evento inválido." };
  }
  if (!seasonTeamPlayerId) {
    return { ok: false, message: "Selecciona un jugador." };
  }
  if (!/^\d+$/.test(minuteRaw)) {
    return { ok: false, message: "El minuto debe ser un entero entre 0 y 130." };
  }
  const minute = Number(minuteRaw);
  if (minute < 0 || minute > 130) {
    return { ok: false, message: "El minuto debe estar entre 0 y 130." };
  }

  const supabase = await createClient();

  // Pre-checks for human messages; authoritative validation is in record_match_event + trigger.
  const { data: canCapture } = await supabase.rpc("can_capture_match", {
    p_match_id: matchId,
  });
  if (!canCapture) {
    return { ok: false, message: "No tienes permiso para capturar este partido." };
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, season_id")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (!match) {
    return { ok: false, message: "Partido no encontrado." };
  }

  if (
    match.status === "finished" ||
    match.status === "cancelled" ||
    match.status === "walkover"
  ) {
    return {
      ok: false,
      message: "No se pueden registrar eventos en un partido cerrado.",
    };
  }

  const { error } = await supabase.rpc("record_match_event", {
    p_match_id: matchId,
    p_season_team_player_id: seasonTeamPlayerId,
    p_event_type: eventType,
    p_minute: minute,
    p_notes: notes || null,
  });

  if (error) {
    return { ok: false, message: humanError(error.message) };
  }

  revalidateMatchPaths(organizationId, competitionId, seasonId, matchId);
  return { ok: true, message: "Evento registrado." };
}
