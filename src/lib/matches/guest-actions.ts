"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MATCH_EVENT_TYPE_OPTIONS,
  MATCH_STATUS_OPTIONS,
  allowedStatusTransitions,
  initialCaptureActionState,
  type CaptureActionState,
  type MatchEventType,
  type MatchStatusValue,
} from "@/lib/matches/types";
import { humanizeCaptureError } from "@/lib/matches/capture-errors";
import {
  classifyGuestInviteError,
  validateGuestUpdateResultAuthorization,
} from "@/lib/matches/guest-official";

function humanError(message: string): CaptureActionState {
  const parsed = humanizeCaptureError(message);
  return {
    ok: false,
    message: classifyGuestInviteError(parsed.message),
    errorKind: parsed.kind,
  };
}

function isEventType(value: string): value is MatchEventType {
  return MATCH_EVENT_TYPE_OPTIONS.some((option) => option.value === value);
}

function isMatchStatus(value: string): value is MatchStatusValue {
  return MATCH_STATUS_OPTIONS.some((option) => option.value === value);
}

export async function setGuestOfficialNameAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const token = String(formData.get("inviteToken") ?? "").trim();
  const guestName = String(formData.get("guestName") ?? "").trim();

  if (!token) {
    return { ok: false, message: "Enlace de invitación inválido." };
  }
  if (!guestName) {
    return {
      ok: false,
      message: "Indica tu nombre para continuar.",
      fieldErrors: { guestName: "El nombre es obligatorio." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_guest_official_name", {
    p_token: token,
    p_name: guestName,
  });

  if (error) {
    return humanError(error.message);
  }

  revalidatePath(`/invitacion-arbitral/${token}`);
  return { ok: true, message: "Nombre guardado." };
}

export async function guestUpdateMatchResultAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const token = String(formData.get("inviteToken") ?? "").trim();
  const matchId = String(formData.get("matchId") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const homeRaw = String(formData.get("homeScore") ?? "").trim();
  const awayRaw = String(formData.get("awayScore") ?? "").trim();

  if (!token || !matchId) {
    return { ok: false, message: "Datos de invitación incompletos." };
  }

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

  const supabase = await createClient();
  const { data: snapshot, error: snapshotError } = await supabase.rpc(
    "get_guest_match_snapshot",
    { p_token: token }
  );

  if (snapshotError || !snapshot?.length) {
    return humanError(snapshotError?.message ?? "Invitación inválida.");
  }

  const current = snapshot[0]!.status as MatchStatusValue;
  if (!allowedStatusTransitions(current).includes(statusRaw)) {
    return {
      ok: false,
      message: `No se puede pasar de «${current}» a «${statusRaw}».`,
    };
  }

  const authCheck = validateGuestUpdateResultAuthorization({
    statusRaw,
    currentStatus: current,
  });
  if (!authCheck.ok) {
    return { ok: false, message: authCheck.message };
  }

  const { error } = await supabase.rpc("guest_update_match_result", {
    p_token: token,
    p_match_id: matchId,
    p_status: statusRaw,
    p_home_score: Number(homeRaw),
    p_away_score: Number(awayRaw),
  });

  if (error) {
    return humanError(error.message);
  }

  revalidatePath(`/invitacion-arbitral/${token}`);
  return { ok: true, message: "Marcador y estado actualizados." };
}

export async function guestRecordMatchEventAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const token = String(formData.get("inviteToken") ?? "").trim();
  const matchId = String(formData.get("matchId") ?? "");
  const eventType = String(formData.get("eventType") ?? "");
  const seasonTeamPlayerId = String(formData.get("seasonTeamPlayerId") ?? "");
  const minuteRaw = String(formData.get("minute") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!token || !matchId) {
    return { ok: false, message: "Datos de invitación incompletos." };
  }

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
  const { error } = await supabase.rpc("guest_record_match_event", {
    p_token: token,
    p_match_id: matchId,
    p_season_team_player_id: seasonTeamPlayerId,
    p_event_type: eventType,
    p_minute: minute,
    p_notes: notes || undefined,
  });

  if (error) {
    return humanError(error.message);
  }

  revalidatePath(`/invitacion-arbitral/${token}`);
  return { ok: true, message: "Evento registrado." };
}

export { initialCaptureActionState };
