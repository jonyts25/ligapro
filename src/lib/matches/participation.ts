"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import { humanizeCaptureError } from "@/lib/matches/capture-errors";
import {
  parseParticipationStatus,
  parseSeasonTeamPlayerIds,
  validateSetMatchParticipantsInput,
  validateValidateMatchRosterInput,
} from "@/lib/matches/participation-validation";
import type { CaptureActionState } from "@/lib/matches/types";

async function revalidateMatchParticipationPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(`${base}/partidos/${matchId}/captura`);
  revalidatePath(`${base}/partidos/${matchId}`);
}

function humanError(message: string): CaptureActionState {
  const parsed = humanizeCaptureError(message);
  return {
    ok: false,
    message: parsed.message,
    errorKind: parsed.kind,
  };
}

export async function setMatchParticipantsAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const seasonTeamPlayerIds = parseSeasonTeamPlayerIds(
    formData.get("seasonTeamPlayerIds")
  );
  const status = parseParticipationStatus(formData.get("status"));

  const validation = validateSetMatchParticipantsInput({
    organizationId,
    competitionId,
    seasonId,
    matchId,
    seasonTeamPlayerIds,
    status,
  });
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  await requireOrganizationMembership(user.id, organizationId);

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ error: { message: string } | null }>;
  }).rpc("set_match_participants", {
    p_match_id: matchId,
    p_season_team_player_ids: seasonTeamPlayerIds,
    p_status: status,
  });

  if (error) {
    return humanError(error.message);
  }

  await revalidateMatchParticipationPaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );

  return { ok: true, message: "Convocatoria actualizada." };
}

export async function validateMatchRosterAction(
  _prev: CaptureActionState,
  formData: FormData
): Promise<CaptureActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const seasonTeamPlayerIds = parseSeasonTeamPlayerIds(
    formData.get("seasonTeamPlayerIds")
  );

  const validation = validateValidateMatchRosterInput({
    organizationId,
    competitionId,
    seasonId,
    matchId,
    seasonTeamPlayerIds,
  });
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  await requireOrganizationMembership(user.id, organizationId);

  const supabase = await createClient();
  const { data: canCapture } = await supabase.rpc("can_capture_match", {
    p_match_id: matchId,
  });
  if (!canCapture) {
    return {
      ok: false,
      message: "No tienes permiso para validar el plantel de este partido.",
      errorKind: "not_authorized",
    };
  }

  const { error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ error: { message: string } | null }>;
  }).rpc("validate_match_roster", {
    p_match_id: matchId,
    p_season_team_player_ids: seasonTeamPlayerIds,
  });

  if (error) {
    return humanError(error.message);
  }

  await revalidateMatchParticipationPaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );

  return { ok: true, message: "Plantel validado." };
}
