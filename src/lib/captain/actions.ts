"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { resolveCaptainPortalDestination } from "@/lib/auth/resolve-auth-destination";
import { hasCaptainTeamAccess } from "@/lib/auth/get-captain-teams";
import {
  humanizeCaptainInvitationError,
  humanizeCaptainPaymentMarkError,
  humanizeCaptainProfileError,
  humanizeCaptainRescheduleError,
} from "@/lib/captain/errors";
import { humanizeCaptainRosterAddError } from "@/lib/captain/roster-errors";
import type { CaptainActionState } from "@/lib/captain/types";

function revalidateCaptainPaths(seasonTeamId: string, matchId?: string) {
  revalidatePath("/mi-equipo");
  revalidatePath(`/mi-equipo/${seasonTeamId}`);
  if (matchId) {
    revalidatePath(`/mi-equipo/${seasonTeamId}/partidos/${matchId}`);
  }
}

function parseLocalDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const iso = `${date}T${time}:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function acceptCaptainInvitationAction(
  _prev: CaptainActionState,
  formData: FormData
): Promise<CaptainActionState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return { ok: false, message: "Enlace de invitación no válido." };
  }

  const user = await requireUser(`/iniciar-sesion?next=${encodeURIComponent(`/invitacion/${token}`)}`);
  const supabase = await createClient();

  const { error } = await supabase.rpc("accept_captain_invitation", {
    p_token: token,
  });

  if (error) {
    return {
      ok: false,
      message: humanizeCaptainInvitationError(error.message),
    };
  }

  const destination = await resolveCaptainPortalDestination(user.id);
  redirect(destination);
}

export async function proposeMatchRescheduleCaptainAction(
  _prev: CaptainActionState,
  formData: FormData
): Promise<CaptainActionState> {
  const user = await requireUser();
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const date = String(formData.get("proposedDate") ?? "");
  const time = String(formData.get("proposedTime") ?? "");
  const fieldId = String(formData.get("proposedFieldId") ?? "").trim();

  const allowed = await hasCaptainTeamAccess(user.id, seasonTeamId);
  if (!allowed) {
    return { ok: false, message: "No tienes acceso a este equipo." };
  }

  const proposedStartsAt = parseLocalDateTime(date, time);
  if (!proposedStartsAt) {
    return {
      ok: false,
      message: "Indica una fecha y hora válidas.",
      fieldErrors: { proposedDate: "Revisa fecha y hora." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_match_reschedule", {
    p_match_id: matchId,
    p_proposed_starts_at: proposedStartsAt,
    p_proposed_field_id: fieldId || undefined,
  });

  if (error) {
    return {
      ok: false,
      message: humanizeCaptainRescheduleError(error.message),
    };
  }

  revalidateCaptainPaths(seasonTeamId, matchId);
  return {
    ok: true,
    message: "Propuesta enviada. Espera la respuesta del rival.",
  };
}

export async function respondMatchRescheduleCaptainAction(
  _prev: CaptainActionState,
  formData: FormData
): Promise<CaptainActionState> {
  const user = await requireUser();
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const approve = formData.get("approve") === "true";

  const allowed = await hasCaptainTeamAccess(user.id, seasonTeamId);
  if (!allowed) {
    return { ok: false, message: "No tienes acceso a este equipo." };
  }

  if (!requestId) {
    return { ok: false, message: "Solicitud no válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_match_reschedule", {
    p_request_id: requestId,
    p_approve: approve,
  });

  if (error) {
    return {
      ok: false,
      message: humanizeCaptainRescheduleError(error.message),
    };
  }

  revalidateCaptainPaths(seasonTeamId, matchId);
  return {
    ok: true,
    message: approve
      ? "Aprobaste la propuesta. La liga confirmará el horario."
      : "Rechazaste la propuesta de reagendado.",
  };
}

export async function setPlayerPaymentMarkCaptainAction(
  _prev: CaptainActionState,
  formData: FormData
): Promise<CaptainActionState> {
  const user = await requireUser();
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const seasonTeamPlayerId = String(formData.get("seasonTeamPlayerId") ?? "");
  const markedPaid = formData.get("markedPaid") === "true";

  const allowed = await hasCaptainTeamAccess(user.id, seasonTeamId);
  if (!allowed) {
    return { ok: false, message: "No tienes acceso a este equipo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_player_payment_mark", {
    p_season_team_player_id: seasonTeamPlayerId,
    p_marked_paid: markedPaid,
  });

  if (error) {
    return {
      ok: false,
      message: humanizeCaptainPaymentMarkError(error.message),
    };
  }

  revalidateCaptainPaths(seasonTeamId);
  return {
    ok: true,
    message: markedPaid ? "Marcado como pagado." : "Marcado como pendiente.",
  };
}

function parseOptionalJersey(
  raw: string
): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error: "El dorsal debe ser un número entero positivo." };
  }
  const value = Number(trimmed);
  if (value <= 0) {
    return { value: null, error: "El dorsal debe ser mayor que cero." };
  }
  return { value };
}

export async function updateCaptainProfileAction(
  _prev: CaptainActionState,
  formData: FormData
): Promise<CaptainActionState> {
  const user = await requireUser("/iniciar-sesion?next=/mi-equipo/perfil");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  if (displayName.length > 0 && displayName.length < 2) {
    return {
      ok: false,
      message: "El nombre debe tener al menos 2 caracteres.",
      fieldErrors: { displayName: "Mínimo 2 caracteres." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      phone: phoneRaw || null,
    })
    .eq("id", user.id);

  if (error) {
    return {
      ok: false,
      message: humanizeCaptainProfileError(error.message),
    };
  }

  revalidatePath("/mi-equipo");
  revalidatePath("/mi-equipo/perfil");
  return {
    ok: true,
    message: "Perfil actualizado.",
  };
}

export async function createPlayerAndAddCaptainAction(
  _prev: CaptainActionState,
  formData: FormData
): Promise<CaptainActionState> {
  const user = await requireUser();
  const seasonTeamId = String(formData.get("seasonTeamId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const jerseyRaw = String(formData.get("jerseyNumber") ?? "");
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  const allowed = await hasCaptainTeamAccess(user.id, seasonTeamId);
  if (!allowed) {
    return { ok: false, message: "No tienes acceso a este equipo." };
  }

  if (fullName.length < 2 || fullName.length > 100) {
    return {
      ok: false,
      message: "El nombre debe tener entre 2 y 100 caracteres.",
      fieldErrors: { fullName: "Entre 2 y 100 caracteres." },
    };
  }

  const jersey = parseOptionalJersey(jerseyRaw);
  if (jersey.error) {
    return {
      ok: false,
      message: jersey.error,
      fieldErrors: { jerseyNumber: jersey.error },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_player_and_add_to_roster", {
    p_season_team_id: seasonTeamId,
    p_full_name: fullName,
    p_jersey_number: jersey.value ?? undefined,
    p_registration_status: "active",
    p_phone: phoneRaw || null,
  });

  if (error) {
    return {
      ok: false,
      message: humanizeCaptainRosterAddError(error.message),
    };
  }

  revalidateCaptainPaths(seasonTeamId);
  return {
    ok: true,
    message: "Jugador agregado al plantel.",
  };
}
