import { createClient } from "@/lib/supabase/server";
import { hasKnockoutBracket } from "@/lib/knockout/queries";
import {
  buildCatchUpFixturePayload,
  evaluateCatchUpEligibility,
  humanizeCatchUpError,
  inferSeasonFixtureMode,
  maxLeagueRoundNumber,
  type CatchUpEligibility,
  type LeagueMatchMeta,
} from "@/lib/fixtures/catch-up-fixture";
import type { FixtureMode } from "@/lib/fixtures/round-robin";

export type CatchUpFixtureContext = {
  eligibility: CatchUpEligibility;
  formatType: string;
  mode: FixtureMode | null;
  opponentSeasonTeamIds: string[];
  maxExistingRound: number;
  pendingCatchUpMatchIds: string[];
};

export async function getCatchUpFixtureContext(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  newSeasonTeamId: string
): Promise<CatchUpFixtureContext | null> {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id, format_type")
    .eq("id", seasonId)
    .eq("organization_id", organizationId)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (!season) return null;

  const [{ data: leagueMatches }, { data: newTeamMatches }, { data: teams }] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          "id, round_number, leg_number, round_label, status, home_season_team_id, away_season_team_id"
        )
        .eq("organization_id", organizationId)
        .eq("season_id", seasonId)
        .is("knockout_round_id", null)
        .is("season_group_id", null),
      supabase
        .from("matches")
        .select("id, status, field_reservation_id, round_label")
        .eq("organization_id", organizationId)
        .eq("season_id", seasonId)
        .or(
          `home_season_team_id.eq.${newSeasonTeamId},away_season_team_id.eq.${newSeasonTeamId}`
        ),
      supabase
        .from("season_teams")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("season_id", seasonId)
        .in("registration_status", ["registered", "confirmed"])
        .neq("id", newSeasonTeamId)
        .order("created_at"),
    ]);

  const league = (leagueMatches ?? []) as LeagueMatchMeta[];
  const mode = inferSeasonFixtureMode(season.format_type, league);
  const opponentSeasonTeamIds = (teams ?? []).map((team) => team.id);

  const eligibility = evaluateCatchUpEligibility({
    formatType: season.format_type,
    existingLeagueMatchCount: league.length,
    newTeamMatchCount: newTeamMatches?.length ?? 0,
    opponentSeasonTeamIds,
  });

  return {
    eligibility,
    formatType: season.format_type,
    mode,
    opponentSeasonTeamIds,
    maxExistingRound: maxLeagueRoundNumber(league),
    pendingCatchUpMatchIds: (newTeamMatches ?? [])
      .filter(
        (match) =>
          !match.field_reservation_id &&
          String(match.round_label ?? "").includes("alcance")
      )
      .map((match) => match.id),
  };
}

export async function generateCatchUpFixture(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  newSeasonTeamId: string
) {
  const context = await getCatchUpFixtureContext(
    organizationId,
    competitionId,
    seasonId,
    newSeasonTeamId
  );

  if (!context?.eligibility.eligible || !context.mode) {
    return {
      ok: false as const,
      message:
        context?.eligibility.message ??
        "No se pueden generar partidos de alcance para este equipo.",
    };
  }

  const built = buildCatchUpFixturePayload({
    newSeasonTeamId,
    opponentSeasonTeamIds: context.opponentSeasonTeamIds,
    mode: context.mode,
    maxExistingRound: context.maxExistingRound,
  });

  const supabase = await createClient();
  type UntypedRpc = {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    "append_season_catch_up_matches",
    {
      p_season_id: seasonId,
      p_new_season_team_id: newSeasonTeamId,
      p_mode: built.mode,
      p_matches: built.payload,
    }
  );

  if (error) {
    return {
      ok: false as const,
      message: humanizeCatchUpError(error.message),
    };
  }

  const rows = (Array.isArray(data) ? data : []) as Array<{ id: string }>;
  const matchIds = rows.map((row) => row.id);

  return {
    ok: true as const,
    matchIds,
    roundNumbers: built.roundNumbers,
  };
}

export async function getSeasonEnrollmentCatchUpGate(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<{ blocked: boolean; message: string | null; formatType: string }> {
  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("format_type")
    .eq("id", seasonId)
    .eq("organization_id", organizationId)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (!season) {
    return { blocked: true, message: "Torneo no encontrado.", formatType: "" };
  }

  if (season.format_type !== "groups_knockout") {
    return { blocked: false, message: null, formatType: season.format_type };
  }

  const knockoutPhaseStarted = await hasKnockoutBracket(
    organizationId,
    seasonId
  );

  if (!knockoutPhaseStarted) {
    return { blocked: false, message: null, formatType: season.format_type };
  }

  return {
    blocked: true,
    message:
      "No se pueden inscribir equipos nuevos: la fase de eliminación ya inició.",
    formatType: season.format_type,
  };
}
