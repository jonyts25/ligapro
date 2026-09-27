import { createClient } from "@/lib/supabase/server";
import { getTeamLogoPublicUrl } from "@/lib/teams/logo-url";

import {
  buildLiveMatchdayAlerts,
  type LiveMatchdayAlert,
} from "./live-matchday-core";

export type { LiveMatchdayAlert, LiveMatchdayAlertId } from "./live-matchday-core";
export {
  buildLiveMatchdayAlerts,
  getMexicoCityDateString,
  shiftMexicoCityDateString,
} from "./live-matchday-core";

export type LiveMatchdayMatch = {
  matchId: string;
  seasonId: string;
  competitionId: string;
  seasonName: string;
  competitionName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogoUrl: string | null;
  awayTeamLogoUrl: string | null;
  startsAt: string;
  venueName: string | null;
  fieldName: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  isResultOfficial: boolean;
  hasConfirmedReferee: boolean;
  hasOpenDispute: boolean;
  homeValidatedCount: number;
  awayValidatedCount: number;
  matchDurationMinutes: number;
  alerts: LiveMatchdayAlert[];
};

export async function fetchOrganizationMatchday(
  organizationId: string,
  date: string
): Promise<LiveMatchdayMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_organization_matchday", {
    p_organization_id: organizationId,
    p_date: date,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const mapped = {
      matchId: row.match_id,
      seasonId: row.season_id,
      competitionId: row.competition_id,
      seasonName: row.season_name,
      competitionName: row.competition_name,
      homeTeamName: row.home_team_name,
      awayTeamName: row.away_team_name,
      homeTeamLogoUrl: getTeamLogoPublicUrl(row.home_team_logo_path),
      awayTeamLogoUrl: getTeamLogoPublicUrl(row.away_team_logo_path),
      startsAt: row.starts_at,
      venueName: row.venue_name,
      fieldName: row.field_name,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      isResultOfficial: row.is_result_official,
      hasConfirmedReferee: row.has_confirmed_referee,
      hasOpenDispute: row.has_open_dispute,
      homeValidatedCount: row.home_validated_count,
      awayValidatedCount: row.away_validated_count,
      matchDurationMinutes: row.match_duration_minutes,
    };

    return {
      ...mapped,
      alerts: buildLiveMatchdayAlerts(mapped),
    };
  });
}
