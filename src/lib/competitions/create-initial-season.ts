import { createClient } from "@/lib/supabase/server";
import { slugifySeasonName, type SeasonFormatType } from "@/lib/competitions/types";
import type { InitialSeasonSetupParsed } from "@/lib/competitions/initial-season-setup";

async function syncGroupsAdvancePerGroup(
  seasonId: string,
  organizationId: string,
  formatType: SeasonFormatType,
  groupsAdvancePerGroup: number | null
) {
  const supabase = await createClient();
  await supabase
    .from("season_rules")
    .update({
      groups_advance_per_group:
        formatType === "groups_knockout" ? groupsAdvancePerGroup : null,
    })
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId);
}

export async function createInitialSeasonForCompetition(
  competitionId: string,
  organizationId: string,
  competitionName: string,
  parsed: InitialSeasonSetupParsed
): Promise<{ seasonId: string } | { error: string }> {
  const supabase = await createClient();
  const seasonName = competitionName.trim();

  const { data: seasonId, error } = await supabase.rpc(
    "create_season_with_rules",
    {
      p_competition_id: competitionId,
      p_name: seasonName,
      p_slug: slugifySeasonName(seasonName),
      p_format_type: parsed.formatType,
      p_visibility: "draft",
      p_starts_on: null as unknown as string,
      p_ends_on: null as unknown as string,
      p_points_win: parsed.pointsWin,
      p_points_draw: parsed.pointsDraw,
      p_points_loss: parsed.pointsLoss,
      p_allow_draws: parsed.allowDraws,
      p_match_duration_minutes: parsed.matchDurationMinutes,
      p_minimum_rest_minutes: parsed.minimumRestMinutes,
      p_yellow_card_limit: parsed.yellowCardLimit,
      p_suspension_matches: parsed.suspensionMatches,
    }
  );

  if (error || !seasonId) {
    return { error: "No pudimos crear el torneo. Inténtalo nuevamente." };
  }

  await syncGroupsAdvancePerGroup(
    seasonId,
    organizationId,
    parsed.formatType,
    parsed.groupsAdvancePerGroup
  );

  return { seasonId };
}
