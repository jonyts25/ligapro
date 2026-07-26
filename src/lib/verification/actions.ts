"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { humanizeCaptureError } from "@/lib/matches/capture-errors";
import type { CaptureActionState } from "@/lib/matches/types";

async function revalidateVerificationPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(`${base}/disciplina`);
  revalidatePath(`${base}/equipos`, "layout");
  revalidatePath(`/organizaciones/${organizationId}/equipos`, "layout");
}

export async function reviewPlayerVerificationAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  await requireOrganizationAdmin(user.id, organizationId);

  if (!playerId) {
    return { ok: false, message: "Jugador no válido." };
  }

  const approved = decision === "approve";
  if (!approved && !reason) {
    return {
      ok: false,
      message: "El motivo es obligatorio para rechazar la verificación.",
      fieldErrors: { reason: "Indica el motivo del rechazo." },
    };
  }

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("id, organization_id, verification_status")
    .eq("id", playerId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!player) {
    return { ok: false, message: "Jugador no encontrado." };
  }

  if (player.verification_status !== "pending") {
    return {
      ok: false,
      message: "Este jugador ya no está pendiente de verificación.",
    };
  }

  const { error } = await supabase.rpc("review_player_verification", {
    p_player_id: playerId,
    p_approved: approved,
    ...(reason ? { p_reason: reason } : {}),
  });

  if (error) {
    const parsed = humanizeCaptureError(error.message);
    return { ok: false, message: parsed.message, errorKind: parsed.kind };
  }

  await revalidateVerificationPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: approved ? "Verificación aprobada." : "Verificación rechazada.",
  };
}
