import type { SupabaseClient } from "@supabase/supabase-js";
import { isAnthropicConfigured } from "@/lib/ai/call-ai";
import { assertCanGenerateChronicleWithClient } from "@/lib/billing/tier-limits-queries";
import { buildChroniclePrompt } from "@/lib/chronicles/build-prompt";
import {
  getLatestChronicleJobForMatch,
  getMatchChronicle,
} from "@/lib/chronicles/queries";
import { runChronicleJob } from "@/lib/chronicles/run-chronicle-job";
import { buildChronicleTimelineForPrompt } from "@/lib/chronicles/timeline-for-prompt";
import {
  getMatchResultApprovalState,
  isMatchResultOfficial,
} from "@/lib/matches/result-review-queries";
import { getMatchTimeline } from "@/lib/matches/queries";
import type { Database } from "@/types/database";

export type GenerateChronicleParams = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  actorProfileId: string | null;
  confirmRegenerate: boolean;
};

export type GenerateChronicleResult = {
  ok: boolean;
  message: string;
};

function isFinishedStatus(status: string): boolean {
  return status === "finished" || status === "walkover";
}

async function loadMatchTeamNames(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  homeSeasonTeamId: string,
  awaySeasonTeamId: string
): Promise<{ homeName: string; awayName: string } | null> {
  const { data } = await supabase
    .from("season_teams")
    .select("id, display_name, teams(name)")
    .eq("organization_id", organizationId)
    .in("id", [homeSeasonTeamId, awaySeasonTeamId]);

  const nameById = new Map<string, string>();
  for (const row of data ?? []) {
    const teamRel = row.teams as
      | { name: string }
      | { name: string }[]
      | null;
    const team = Array.isArray(teamRel) ? teamRel[0] : teamRel;
    nameById.set(
      row.id,
      row.display_name?.trim() || team?.name || "Equipo"
    );
  }

  const homeName = nameById.get(homeSeasonTeamId);
  const awayName = nameById.get(awaySeasonTeamId);
  if (!homeName || !awayName) return null;

  return { homeName, awayName };
}

export async function generateChronicleForMatch(
  params: GenerateChronicleParams
): Promise<GenerateChronicleResult> {
  const {
    supabase,
    organizationId,
    competitionId,
    seasonId,
    matchId,
    actorProfileId,
    confirmRegenerate,
  } = params;

  const existing = await getMatchChronicle(organizationId, matchId, supabase);
  if (existing?.isPublished && !confirmRegenerate) {
    return {
      ok: false,
      message:
        "Ya hay una crónica publicada. Generar una nueva la reemplazará y quedará sin publicar hasta que la revises.",
    };
  }

  const pendingJob = await getLatestChronicleJobForMatch(
    organizationId,
    matchId,
    supabase
  );
  if (
    pendingJob &&
    (pendingJob.status === "pending" || pendingJob.status === "processing")
  ) {
    return { ok: true, message: "Ya en proceso" };
  }

  const approval = await getMatchResultApprovalState(
    supabase,
    organizationId,
    matchId
  );
  if (!approval) {
    return { ok: false, message: "Partido no encontrado." };
  }

  if (!isMatchResultOfficial(approval.approvedAt)) {
    return { ok: false, message: "El resultado todavía no es oficial." };
  }

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, status, home_score, away_score, home_season_team_id, away_season_team_id"
    )
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (!match) {
    return { ok: false, message: "Partido no encontrado." };
  }

  if (!isFinishedStatus(match.status)) {
    return {
      ok: false,
      message: "Solo se puede generar crónica en partidos finalizados.",
    };
  }

  if (match.home_score == null || match.away_score == null) {
    return {
      ok: false,
      message: "El partido necesita marcador oficial antes de generar la crónica.",
    };
  }

  const teamNames = await loadMatchTeamNames(
    supabase,
    organizationId,
    match.home_season_team_id,
    match.away_season_team_id
  );
  if (!teamNames) {
    return { ok: false, message: "No se pudieron cargar los equipos del partido." };
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("is_youth")
    .eq("id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const isYouth = competition?.is_youth ?? false;

  const timeline = await getMatchTimeline(organizationId, matchId, supabase);
  const eventsForPrompt = buildChronicleTimelineForPrompt(timeline, isYouth);

  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      message:
        "ANTHROPIC_API_KEY no está configurada en el servidor. No se puede generar la crónica.",
    };
  }

  const tierCheck = await assertCanGenerateChronicleWithClient(
    supabase,
    organizationId
  );
  if (!tierCheck.ok) {
    return { ok: false, message: tierCheck.message };
  }

  const prompt = buildChroniclePrompt({
    homeTeamName: teamNames.homeName,
    awayTeamName: teamNames.awayName,
    homeSeasonTeamId: match.home_season_team_id,
    awaySeasonTeamId: match.away_season_team_id,
    homeScore: match.home_score,
    awayScore: match.away_score,
    events: eventsForPrompt,
  });

  const { data: job, error } = await supabase
    .from("ai_jobs")
    .insert({
      organization_id: organizationId,
      app: "ligera",
      tipo: "cronica",
      payload: {
        prompt,
        match_id: matchId,
        tier: "basico",
      },
      status: "pending",
      created_by: actorProfileId,
    })
    .select("id")
    .single();

  if (error || !job) {
    return { ok: false, message: error?.message ?? "No se pudo encolar el trabajo." };
  }

  const result = await runChronicleJob(supabase, {
    jobId: job.id,
    organizationId,
    matchId,
    prompt,
    tier: "basico",
  });

  if (!result.ok) {
    return { ok: false, message: result.errorMessage };
  }

  return {
    ok: true,
    message: "Crónica generada. Revísala y publícala cuando esté lista.",
  };
}
