"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { humanizeCaptureError } from "@/lib/matches/capture-errors";
import type { CaptureActionState } from "@/lib/matches/types";

function humanError(message: string): CaptureActionState {
  const parsed = humanizeCaptureError(message);
  return {
    ok: false,
    message: parsed.message,
    errorKind: parsed.kind,
  };
}

async function revalidateMatchReviewPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(`${base}/partidos/${matchId}`);
  revalidatePath(`${base}/partidos/${matchId}/captura`);
}

export async function openMatchResultDisputeAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!organizationId || !competitionId || !seasonId || !matchId) {
    return { ok: false, message: "Datos del partido incompletos." };
  }

  if (!reason) {
    return { ok: false, message: "Indica el motivo de la disputa." };
  }

  await requireOrganizationMembership(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_match_result_dispute", {
    p_match_id: matchId,
    p_reason: reason,
  });

  if (error) {
    return humanError(error.message);
  }

  await revalidateMatchReviewPaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );
  return { ok: true, message: "Disputa registrada." };
}

export async function approveMatchResultAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  if (!organizationId || !competitionId || !seasonId || !matchId) {
    return { ok: false, message: "Datos del partido incompletos." };
  }

  await requireOrganizationMembership(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_match_result", {
    p_match_id: matchId,
  });

  if (error) {
    return humanError(error.message);
  }

  await revalidateMatchReviewPaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );
  return { ok: true, message: "Resultado aprobado." };
}
