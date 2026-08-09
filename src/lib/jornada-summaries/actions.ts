"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { tieneAccesoPremium } from "@/lib/organizations/premium-access";
import { buildJornadaSummaryPrompt } from "@/lib/jornada-summaries/build-prompt";
import {
  getJornadaSummary,
  getLatestJornadaSummaryJob,
} from "@/lib/jornada-summaries/queries";
import {
  initialJornadaSummaryActionState,
  jornadaRoundLabel,
  type JornadaSummaryActionState,
} from "@/lib/jornada-summaries/types";
import { getSeasonMatchesGroupedByRound } from "@/lib/fixtures/queries";
import { getSeasonStandings } from "@/lib/standings/queries";
import { getMatchCaptureContext } from "@/lib/matches/queries";

async function revalidateJornadaPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  revalidatePath(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/calendario`
  );
}

export async function enqueueJornadaSummaryAction(
  _prev: JornadaSummaryActionState,
  formData: FormData
): Promise<JornadaSummaryActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const roundNumber = Number(formData.get("roundNumber") ?? "");
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

  const roundLabel = jornadaRoundLabel(roundNumber);
  const existing = await getJornadaSummary(organizationId, seasonId, roundLabel);
  if (existing?.isPublished && !confirmRegenerate) {
    return {
      ok: false,
      needsConfirm: true,
      message:
        "Ya hay un resumen publicado. Generar uno nuevo lo reemplazará y quedará sin publicar hasta que lo revises.",
    };
  }

  const pendingJob = await getLatestJornadaSummaryJob(
    organizationId,
    seasonId,
    roundLabel
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

  const fixture = await getSeasonMatchesGroupedByRound(
    organizationId,
    competitionId,
    seasonId
  );
  if (!fixture) {
    return { ok: false, message: "Temporada no encontrada." };
  }

  const round = fixture.rounds.find((r) => r.roundNumber === roundNumber);
  if (!round) {
    return { ok: false, message: "Jornada no encontrada." };
  }

  const finishedMatches = round.matches.filter(
    (m) =>
      (m.status === "finished" || m.status === "walkover") &&
      m.homeScore != null &&
      m.awayScore != null
  );

  if (finishedMatches.length === 0) {
    return {
      ok: false,
      message:
        "Necesitas al menos un partido finalizado con marcador en esta jornada.",
    };
  }

  const standingsAfter = await getSeasonStandings(organizationId, seasonId);
  const matchContexts = [];

  for (const match of finishedMatches) {
    const ctx = await getMatchCaptureContext(
      organizationId,
      competitionId,
      seasonId,
      match.id,
      user.id,
      "organization_admin"
    );
    if (!ctx) continue;
    matchContexts.push({
      homeTeamName: match.homeName,
      awayTeamName: match.awayName,
      homeSeasonTeamId: match.homeSeasonTeamId,
      awaySeasonTeamId: match.awaySeasonTeamId,
      homeScore: match.homeScore!,
      awayScore: match.awayScore!,
      events: ctx.timeline.filter((e) => e.voidedAt == null),
    });
  }

  const prompt = buildJornadaSummaryPrompt({
    roundLabel,
    matches: round.matches,
    standingsBefore: standingsAfter,
    standingsAfter,
    matchContexts,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("ai_jobs").insert({
    organization_id: organizationId,
    app: "ligera",
    tipo: "resumen_jornada",
    payload: {
      prompt,
      season_id: seasonId,
      round_label: roundLabel,
      competition_id: competitionId,
    },
    status: "pending",
    created_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await revalidateJornadaPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message:
      "Resumen encolado. El worker local lo procesará; revisa antes de publicar.",
  };
}

export async function setJornadaSummaryPublishedAction(
  _prev: JornadaSummaryActionState,
  formData: FormData
): Promise<JornadaSummaryActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const roundNumber = Number(formData.get("roundNumber") ?? "");
  const publish = formData.get("publish") === "true";

  if (!organizationId || !competitionId || !seasonId || !Number.isFinite(roundNumber)) {
    return { ok: false, message: "Datos incompletos." };
  }

  const user = await requireUser();
  await requireOrganizationAdmin(user.id, organizationId);

  if (!(await tieneAccesoPremium(organizationId))) {
    return { ok: false, message: "Requiere plan Premium." };
  }

  const roundLabel = jornadaRoundLabel(roundNumber);
  const summary = await getJornadaSummary(organizationId, seasonId, roundLabel);
  if (!summary) {
    return { ok: false, message: "Aún no hay resumen generado para esta jornada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("jornada_summaries")
    .update({ is_published: publish })
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("round_label", roundLabel);

  if (error) {
    return { ok: false, message: error.message };
  }

  await revalidateJornadaPaths(organizationId, competitionId, seasonId);
  return {
    ok: true,
    message: publish ? "Resumen publicado." : "Resumen despublicado.",
  };
}

export { initialJornadaSummaryActionState };
