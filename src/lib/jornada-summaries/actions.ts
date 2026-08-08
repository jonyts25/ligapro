"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { tieneAccesoPremium } from "@/lib/billing/premium-access";
import { buildJornadaSummaryPrompt } from "@/lib/jornada-summaries/build-prompt";
import {
  getJornadaSummary,
  getLatestJornadaSummaryJob,
} from "@/lib/jornada-summaries/queries";
import type { JornadaSummaryActionState } from "@/lib/jornada-summaries/types";
import { getSeasonStandings } from "@/lib/standings/queries";

async function revalidateJornadaPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  revalidatePath(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/calendario`
  );
}

function isFinishedStatus(status: string): boolean {
  return status === "finished" || status === "walkover";
}

export async function enqueueJornadaSummaryAction(
  _prev: JornadaSummaryActionState,
  formData: FormData
): Promise<JornadaSummaryActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const roundNumber = Number.parseInt(String(formData.get("roundNumber") ?? ""), 10);
  const seasonName = String(formData.get("seasonName") ?? "Temporada");
  const confirmRegenerate = formData.get("confirmRegenerate") === "true";

  if (!organizationId || !competitionId || !seasonId || !Number.isFinite(roundNumber)) {
    return { ok: false, message: "Datos incompletos." };
  }

  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  if (!(await tieneAccesoPremium(organizationId))) {
    return {
      ok: false,
      message: "El resumen de jornada con IA requiere plan Premium.",
    };
  }

  const existing = await getJornadaSummary(organizationId, seasonId, roundNumber);
  if (existing?.isPublished && !confirmRegenerate) {
    return {
      ok: false,
      needsConfirm: true,
      message:
        "Ya hay un resumen publicado. Generar uno nuevo lo reemplazará y quedará sin publicar hasta revisarlo.",
    };
  }

  const pendingJob = await getLatestJornadaSummaryJob(
    organizationId,
    seasonId,
    roundNumber
  );
  if (
    pendingJob &&
    (pendingJob.status === "pending" || pendingJob.status === "processing")
  ) {
    return {
      ok: false,
      message: "Ya hay un resumen en cola o procesándose para esta jornada.",
    };
  }

  const supabase = await createClient();
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, home_score, away_score, status, home_season_team_id, away_season_team_id"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("round_number", roundNumber)
    .is("voided_at", null);

  if (matchError) {
    return { ok: false, message: matchError.message };
  }

  const finished = (matches ?? []).filter(
    (m) =>
      isFinishedStatus(m.status) &&
      m.home_score != null &&
      m.away_score != null
  );

  if (finished.length === 0) {
    return {
      ok: false,
      message: "No hay partidos finalizados en esta jornada.",
    };
  }

  const seasonTeamIds = new Set<string>();
  for (const m of finished) {
    seasonTeamIds.add(m.home_season_team_id);
    seasonTeamIds.add(m.away_season_team_id);
  }

  const { data: teams } = await supabase
    .from("season_teams")
    .select("id, display_name, teams(name)")
    .in("id", [...seasonTeamIds]);

  const teamNames = new Map<string, string>();
  for (const st of teams ?? []) {
    const rel = st.teams as { name: string } | { name: string }[] | null;
    const base = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    teamNames.set(st.id, st.display_name?.trim() || base || "Equipo");
  }

  const matchIds = finished.map((m) => m.id);
  const { data: events } = await supabase
    .from("match_events")
    .select("match_id, event_type, minute, voided_at")
    .in("match_id", matchIds)
    .is("voided_at", null);

  const eventsByMatch = new Map<string, string[]>();
  for (const ev of events ?? []) {
    const list = eventsByMatch.get(ev.match_id) ?? [];
    list.push(`${ev.event_type} ${ev.minute}'`);
    eventsByMatch.set(ev.match_id, list);
  }

  const standings = await getSeasonStandings(organizationId, seasonId);

  const prompt = buildJornadaSummaryPrompt({
    seasonName,
    roundNumber,
    matches: finished.map((m) => ({
      homeName: teamNames.get(m.home_season_team_id) ?? "Local",
      awayName: teamNames.get(m.away_season_team_id) ?? "Visitante",
      homeScore: m.home_score as number,
      awayScore: m.away_score as number,
      eventsSummary: (eventsByMatch.get(m.id) ?? []).join(", "),
    })),
    standingsAfter: standings.map((row) => ({
      position: row.position,
      teamName: row.teamName,
      points: row.points,
      played: row.played,
    })),
  });

  const { error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ error: { message: string } | null }>;
  }).rpc("enqueue_jornada_summary", {
    p_season_id: seasonId,
    p_round_number: roundNumber,
    p_prompt: prompt,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await revalidateJornadaPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message:
      "Resumen encolado. El worker local lo procesará; usa «Actualizar estado» para revisar.",
  };
}

export async function setJornadaSummaryPublishedAction(
  _prev: JornadaSummaryActionState,
  formData: FormData
): Promise<JornadaSummaryActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const roundNumber = Number.parseInt(String(formData.get("roundNumber") ?? ""), 10);
  const publish = formData.get("publish") === "true";

  if (!organizationId || !competitionId || !seasonId || !Number.isFinite(roundNumber)) {
    return { ok: false, message: "Datos incompletos." };
  }

  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  const summary = await getJornadaSummary(organizationId, seasonId, roundNumber);
  if (!summary) {
    return { ok: false, message: "Aún no hay resumen generado para esta jornada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("jornada_summaries")
    .update({ is_published: publish })
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("round_number", roundNumber);

  if (error) {
    return { ok: false, message: error.message };
  }

  await revalidateJornadaPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: publish ? "Resumen publicado." : "Resumen despublicado.",
  };
}

export async function refreshJornadaSummaryAction(
  _prev: JornadaSummaryActionState,
  formData: FormData
): Promise<JornadaSummaryActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");

  if (!organizationId || !competitionId || !seasonId) {
    return { ok: false, message: "Datos incompletos." };
  }

  await requireUser();
  await revalidateJornadaPaths(organizationId, competitionId, seasonId);
  return { ok: true, message: null };
}
