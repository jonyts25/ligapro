import { createClient } from "@/lib/supabase/server";
import { mapPublicPlayerName } from "@/lib/public-season/player-names";
import type {
  PublicDisciplineRow,
  PublicMatchRow,
  PublicScorerRow,
  PublicSeasonOverview,
  PublicStandingRow,
} from "@/lib/public-season/types";
import { getPublicSeasonYouthFlag } from "@/lib/public-season/youth-flag";

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
  match_id: string;
  round_label: string | null;
  round_number: number | null;
  sequence_in_round: number | null;
  home_team_name: string;
  away_team_name: string;
  status: string;
  calendar_status: string;
  home_score: number | null;
  away_score: number | null;
  starts_at: string | null;
  venue_name: string | null;
  field_name: string | null;
  knockout_round_number: number | null;
  bracket_slot: number | null;
  leg_number: number | null;
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
  seasonSlug: string,
  groupName?: string | null
): Promise<PublicStandingRow[]> {
  const args: Record<string, unknown> = {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
  };
  if (groupName) args.p_group_name = groupName;
  const rows = await callRpc<StandingRpcRow>("get_public_season_standings", args);
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
    matchId: row.match_id,
    roundLabel: row.round_label,
    roundNumber: row.round_number,
    sequenceInRound: row.sequence_in_round,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    status: row.status,
    calendarStatus: row.calendar_status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    startsAt: row.starts_at,
    venueName: row.venue_name,
    fieldName: row.field_name,
    knockoutRoundNumber: row.knockout_round_number,
    bracketSlot: row.bracket_slot,
    legNumber: row.leg_number,
  }));
}

export async function getPublicSeasonScorers(
  organizationId: string,
  seasonSlug: string
): Promise<PublicScorerRow[]> {
  const isYouth = await getPublicSeasonYouthFlag(organizationId, seasonSlug);
  const rows = await callRpc<ScorerRpcRow>("get_public_season_scorers", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
  });
  return rows.map((row) => ({
    position: row.position,
    playerName: mapPublicPlayerName(row.player_name, isYouth),
    teamName: row.team_name,
    goals: row.goals,
  }));
}

export async function getPublicSeasonDiscipline(
  organizationId: string,
  seasonSlug: string
): Promise<PublicDisciplineRow[]> {
  const isYouth = await getPublicSeasonYouthFlag(organizationId, seasonSlug);
  const rows = await callRpc<DisciplineRpcRow>(
    "get_public_season_discipline",
    {
      p_organization_id: organizationId,
      p_season_slug: seasonSlug,
    }
  );
  return rows.map((row) => ({
    playerName: mapPublicPlayerName(row.player_name, isYouth),
    teamName: row.team_name,
    isSuspended: row.is_suspended,
    matchesRemaining: row.matches_remaining,
  }));
}

export async function getPublicSeasonGroupsList(
  organizationId: string,
  seasonSlug: string
): Promise<Array<{ id: string; name: string }>> {
  const rows = await callRpc<{ group_id: string; group_name: string }>(
    "get_public_season_groups",
    {
      p_organization_id: organizationId,
      p_season_slug: seasonSlug,
    }
  );
  return rows.map((r) => ({ id: r.group_id, name: r.group_name }));
}

type PublicMatchDetailRpcRow = {
  match_id: string;
  home_team_name: string;
  away_team_name: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  starts_at: string | null;
  venue_name: string | null;
  field_name: string | null;
  round_label: string | null;
  round_number: number | null;
  leg_number: number | null;
};

type PublicMatchEventRpcRow = {
  minute: number;
  event_type: string;
  player_name: string;
  team_name: string;
};

type PublicMatchChronicleRpcRow = {
  content: string;
  tier: string;
  generated_at: string;
};

export async function getPublicMatchDetail(
  organizationId: string,
  seasonSlug: string,
  matchId: string
) {
  const rows = await callRpc<PublicMatchDetailRpcRow>("get_public_match_detail", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
    p_match_id: matchId,
  });
  const row = rows[0];
  if (!row) return null;
  return {
    matchId: row.match_id,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    startsAt: row.starts_at,
    venueName: row.venue_name,
    fieldName: row.field_name,
    roundLabel: row.round_label,
    roundNumber: row.round_number,
    legNumber: row.leg_number,
  };
}

export async function getPublicMatchEvents(
  organizationId: string,
  seasonSlug: string,
  matchId: string
) {
  const isYouth = await getPublicSeasonYouthFlag(organizationId, seasonSlug);
  const rows = await callRpc<PublicMatchEventRpcRow>("get_public_match_events", {
    p_organization_id: organizationId,
    p_season_slug: seasonSlug,
    p_match_id: matchId,
  });
  return rows.map((row) => ({
    minute: row.minute,
    eventType: row.event_type,
    playerName: mapPublicPlayerName(row.player_name, isYouth),
    teamName: row.team_name,
  }));
}

export async function getPublicMatchChronicle(
  organizationId: string,
  seasonSlug: string,
  matchId: string
) {
  const rows = await callRpc<PublicMatchChronicleRpcRow>(
    "get_public_match_chronicle",
    {
      p_organization_id: organizationId,
      p_season_slug: seasonSlug,
      p_match_id: matchId,
    }
  );
  const row = rows[0];
  if (!row) return null;
  return {
    content: row.content,
    tier: row.tier,
    generatedAt: row.generated_at,
  };
}
