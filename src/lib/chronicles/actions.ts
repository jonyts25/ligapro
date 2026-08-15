"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { buildChroniclePrompt } from "@/lib/chronicles/build-prompt";
import { buildChronicleTimelineForPrompt } from "@/lib/chronicles/timeline-for-prompt";
import {
  getLatestChronicleJobForMatch,
  getMatchChronicle,
} from "@/lib/chronicles/queries";
import type { ChronicleActionState } from "@/lib/chronicles/types";
import { getMatchCaptureContext } from "@/lib/matches/queries";

async function revalidateChroniclePaths(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(`${base}/partidos/${matchId}`);

  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("slug")
    .eq("id", seasonId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (season?.slug) {
    revalidatePath(
      `/publico/${organizationId}/${season.slug}/partidos/${matchId}`
    );
    revalidatePath(`/publico/${organizationId}/${season.slug}`);
  }
}

function isFinishedStatus(status: string): boolean {
  return status === "finished" || status === "walkover";
}

export async function enqueueChronicleAction(
  _prev: ChronicleActionState,
  formData: FormData
): Promise<ChronicleActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const confirmRegenerate = formData.get("confirmRegenerate") === "true";

  if (!organizationId || !competitionId || !seasonId || !matchId) {
    return { ok: false, message: "Datos del partido incompletos." };
  }

  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const existing = await getMatchChronicle(organizationId, matchId);
  if (existing?.isPublished && !confirmRegenerate) {
    return {
      ok: false,
      needsConfirm: true,
      message:
        "Ya hay una crónica publicada. Generar una nueva la reemplazará y quedará sin publicar hasta que la revises.",
    };
  }

  const pendingJob = await getLatestChronicleJobForMatch(organizationId, matchId);
  if (
    pendingJob &&
    (pendingJob.status === "pending" || pendingJob.status === "processing")
  ) {
    return {
      ok: false,
      message: "Ya hay una crónica en cola o procesándose para este partido.",
    };
  }

  const ctx = await getMatchCaptureContext(
    organizationId,
    competitionId,
    seasonId,
    matchId,
    user.id,
    "organization_admin"
  );
  if (!ctx) {
    return { ok: false, message: "Partido no encontrado." };
  }

  const match = ctx.details.match;
  if (!isFinishedStatus(match.status)) {
    return {
      ok: false,
      message: "Solo se puede generar crónica en partidos finalizados.",
    };
  }

  if (match.homeScore == null || match.awayScore == null) {
    return {
      ok: false,
      message: "El partido necesita marcador oficial antes de generar la crónica.",
    };
  }

  const supabase = await createClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select("is_youth")
    .eq("id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const isYouth = competition?.is_youth ?? false;

  const eventsForPrompt = buildChronicleTimelineForPrompt(ctx.timeline, isYouth);

  const prompt = buildChroniclePrompt({
    homeTeamName: match.homeName,
    awayTeamName: match.awayName,
    homeSeasonTeamId: match.homeSeasonTeamId,
    awaySeasonTeamId: match.awaySeasonTeamId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    events: eventsForPrompt,
  });

  const { error } = await supabase.from("ai_jobs").insert({
    organization_id: organizationId,
    app: "ligera",
    tipo: "cronica",
    payload: {
      prompt,
      match_id: matchId,
      tier: "basico",
    },
    status: "pending",
    created_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await revalidateChroniclePaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );

  return {
    ok: true,
    message:
      "Crónica encolada. El worker local la procesará en unos minutos; usa «Actualizar estado» para revisar.",
  };
}

export async function setChroniclePublishedAction(
  _prev: ChronicleActionState,
  formData: FormData
): Promise<ChronicleActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const publish = formData.get("publish") === "true";

  if (!organizationId || !competitionId || !seasonId || !matchId) {
    return { ok: false, message: "Datos del partido incompletos." };
  }

  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const chronicle = await getMatchChronicle(organizationId, matchId);
  if (!chronicle) {
    return { ok: false, message: "Aún no hay crónica generada para este partido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("match_chronicles")
    .update({ is_published: publish })
    .eq("organization_id", organizationId)
    .eq("match_id", matchId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await revalidateChroniclePaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );

  return {
    ok: true,
    message: publish ? "Crónica publicada." : "Crónica despublicada.",
  };
}

export async function refreshChroniclePanelAction(
  _prev: ChronicleActionState,
  formData: FormData
): Promise<ChronicleActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  if (!organizationId || !competitionId || !seasonId || !matchId) {
    return { ok: false, message: "Datos del partido incompletos." };
  }

  await requireUser();
  await revalidateChroniclePaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );

  return { ok: true, message: null };
}
