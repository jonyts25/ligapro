import { createClient } from "@/lib/supabase/server";
import type {
  PublicDisciplineRow,
  PublicMatchRow,
  PublicScorerRow,
  PublicSeasonOverview,
  PublicStandingRow,
} from "@/lib/public-season/types";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc(
    fn,
    args
  );
  if (error || !data) return [];
  return data as T[];
}

type OverviewRpcRow = {
  organization_name: string;
  organization_logo_path: string | null;
  organization_brand_color: string | null;
  competition_name: string;
  season_name: string;
  season_slug: string;
  format_type: string;
  starts_on: string | null;
  ends_on: string | null;
  visibility: string;
};

type StandingRpcRow = {
  position: number;
  team_name: string;
  registration_status: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  recent_form: string;
};

type MatchRpcRow = {
  round_label: string | null;
  round_number: number | null;
  sequence_in_round: number | null;
  home_team_name: string;
  away_team_name: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  starts_at: string | null;
  venue_name: string | null;
  field_name: string | null;
};

type ScorerRpcRow = {
  position: number;
  player_name: string;
  team_name: string;
  goals: number;
};

type DisciplineRpcRow = {
  player_name: string;
  team_name: string;
  is_suspended: boolean;
  matches_remaining: number;
};

export async function getPublicSeasonOverview(
  organizationId: string,
  seasonSlug: string
): Promise<PublicSeasonOverview | null> {
  const rows = await callRpc<OverviewRpcRow>("get_public_season_overview", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
  });
  const row = rows[0];
  if (!row) return null;
  return {
    organizationName: row.organization_name,
    organizationLogoPath: row.organization_logo_path,
    organizationBrandColor: row.organization_brand_color,
    competitionName: row.competition_name,
    seasonName: row.season_name,
    seasonSlug: row.season_slug,
    formatType: row.format_type,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    visibility: row.visibility,
  };
}

export async function getPublicSeasonStandings(
  organizationId: string,
  seasonSlug: string
): Promise<PublicStandingRow[]> {
  const rows = await callRpc<StandingRpcRow>("get_public_season_standings", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
  });
  return rows.map((row) => ({
    position: row.position,
    teamName: row.team_name,
    registrationStatus: row.registration_status,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDifference: row.goal_difference,
    points: row.points,
    recentForm: row.recent_form ?? "",
  }));
}

export async function getPublicSeasonMatches(
  organizationId: string,
  seasonSlug: string
): Promise<PublicMatchRow[]> {
  const rows = await callRpc<MatchRpcRow>("get_public_season_matches", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
  });
  return rows.map((row) => ({
    roundLabel: row.round_label,
    roundNumber: row.round_number,
    sequenceInRound: row.sequence_in_round,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    startsAt: row.starts_at,
    venueName: row.venue_name,
    fieldName: row.field_name,
  }));
}

export async function getPublicSeasonScorers(
  organizationId: string,
  seasonSlug: string
): Promise<PublicScorerRow[]> {
  const rows = await callRpc<ScorerRpcRow>("get_public_season_scorers", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
  });
  return rows.map((row) => ({
    position: row.position,
    playerName: row.player_name,
    teamName: row.team_name,
    goals: row.goals,
  }));
}

export async function getPublicSeasonDiscipline(
  organizationId: string,
  seasonSlug: string
): Promise<PublicDisciplineRow[]> {
  const rows = await callRpc<DisciplineRpcRow>(
    "get_public_season_discipline",
    {
      p_organization_id: organizationId,
      p_season_slug: seasonSlug,
    }
  );
  return rows.map((row) => ({
    playerName: row.player_name,
    teamName: row.team_name,
    isSuspended: row.is_suspended,
    matchesRemaining: row.matches_remaining,
  }));
}
