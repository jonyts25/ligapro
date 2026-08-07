"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationMembership } from "@/lib/auth/require-organization-membership";
import type { MatchStatsActionState } from "@/lib/match-stats/types";

export const initialMatchStatsActionState: MatchStatsActionState = {
  ok: false,
  message: null,
};

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function parseOptionalDecimal(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function statsPagePath(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string
): string {
  return `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/partidos/${matchId}/captura/estadisticas`;
}

export async function saveMatchStatsAction(
  _prev: MatchStatsActionState,
  formData: FormData
): Promise<MatchStatsActionState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const homeSeasonTeamId = String(formData.get("homeSeasonTeamId") ?? "");
  const awaySeasonTeamId = String(formData.get("awaySeasonTeamId") ?? "");

  await requireOrganizationMembership(user.id, organizationId);

  const supabase = await createClient();

  const homePossession = parseOptionalDecimal(formData.get("homePossessionPct"));
  if (
    homePossession != null &&
    (homePossession < 0 || homePossession > 100)
  ) {
    return { ok: false, message: "Posesión local debe estar entre 0 y 100." };
  }
  const awayPossession = parseOptionalDecimal(formData.get("awayPossessionPct"));
  if (
    awayPossession != null &&
    (awayPossession < 0 || awayPossession > 100)
  ) {
    return {
      ok: false,
      message: "Posesión visitante debe estar entre 0 y 100.",
    };
  }

  const teamPayloads = [
    {
      seasonTeamId: homeSeasonTeamId,
      shots: parseOptionalInt(formData.get("homeShots")),
      shotsOnTarget: parseOptionalInt(formData.get("homeShotsOnTarget")),
      possessionPct: homePossession,
      corners: parseOptionalInt(formData.get("homeCorners")),
      fouls: parseOptionalInt(formData.get("homeFouls")),
      offsides: parseOptionalInt(formData.get("homeOffsides")),
    },
    {
      seasonTeamId: awaySeasonTeamId,
      shots: parseOptionalInt(formData.get("awayShots")),
      shotsOnTarget: parseOptionalInt(formData.get("awayShotsOnTarget")),
      possessionPct: awayPossession,
      corners: parseOptionalInt(formData.get("awayCorners")),
      fouls: parseOptionalInt(formData.get("awayFouls")),
      offsides: parseOptionalInt(formData.get("awayOffsides")),
    },
  ];

  for (const team of teamPayloads) {
    if (!team.seasonTeamId) continue;
    const { error } = await supabase.rpc("set_match_team_stats", {
      p_match_id: matchId,
      p_season_team_id: team.seasonTeamId,
      p_shots: team.shots,
      p_shots_on_target: team.shotsOnTarget,
      p_possession_pct: team.possessionPct,
      p_corners: team.corners,
      p_fouls: team.fouls,
      p_offsides: team.offsides,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
  }

  const attendance = parseOptionalInt(formData.get("attendance"));
  const weather = String(formData.get("weather") ?? "").trim();
  const refereeName = String(formData.get("refereeName") ?? "").trim();
  const highlightNote = String(formData.get("highlightNote") ?? "").trim();

  const { error: contextError } = await supabase.rpc("set_match_context", {
    p_match_id: matchId,
    p_attendance: attendance,
    p_weather: weather || null,
    p_referee_name: refereeName || null,
    p_highlight_note: highlightNote || null,
  });

  if (contextError) {
    return { ok: false, message: contextError.message };
  }

  revalidatePath(statsPagePath(organizationId, competitionId, seasonId, matchId));
  revalidatePath(
    `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/partidos/${matchId}/captura`
  );

  return { ok: true, message: "Estadísticas guardadas." };
}
