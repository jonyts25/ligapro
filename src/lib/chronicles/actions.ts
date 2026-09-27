"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { generateChronicleForMatch } from "@/lib/chronicles/generate-chronicle";
import { getMatchChronicle } from "@/lib/chronicles/queries";
import type { ChronicleActionState } from "@/lib/chronicles/types";

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

  const supabase = await createClient();
  const result = await generateChronicleForMatch({
    supabase,
    organizationId,
    competitionId,
    seasonId,
    matchId,
    actorProfileId: user.id,
    confirmRegenerate,
  });

  await revalidateChroniclePaths(
    organizationId,
    competitionId,
    seasonId,
    matchId
  );

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      needsConfirm:
        result.message.includes("crónica publicada") && !confirmRegenerate,
    };
  }

  return { ok: true, message: result.message };
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
