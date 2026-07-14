import { createClient } from "@/lib/supabase/server";
import type {
  DisciplineSummaryRow,
  ScoreMismatchRow,
  StandingRow,
  TopScorerRow,
} from "@/lib/standings/types";

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

type StandingRpcRow = {
  position: number;
  season_team_id: string;
  team_id: string;
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

type ScorerRpcRow = {
  position: number;
  player_id: string;
  player_name: string;
  season_team_id: string;
  team_name: string;
  goals: number;
};

type DisciplineRpcRow = {
  player_id: string;
  player_name: string;
  season_team_id: string;
  team_name: string;
  yellow_cards: number;
  red_cards: number;
  active_suspensions: number;
  matches_remaining: number;
  suspension_status: string | null;
};

function mapStanding(row: StandingRpcRow): StandingRow {
  return {
    position: row.position,
    seasonTeamId: row.season_team_id,
    teamId: row.team_id,
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
  };
}

export async function getSeasonStandings(
  seasonId: string
): Promise<StandingRow[]> {
  const rows = await callRpc<StandingRpcRow>("get_season_standings", {
    p_season_id: seasonId,
  });
  return rows.map(mapStanding);
}

export async function getSeasonTopScorers(
  seasonId: string
): Promise<TopScorerRow[]> {
  const rows = await callRpc<ScorerRpcRow>("get_season_top_scorers", {
    p_season_id: seasonId,
  });
  return rows.map((row) => ({
    position: row.position,
    playerId: row.player_id,
    playerName: row.player_name,
    seasonTeamId: row.season_team_id,
    teamName: row.team_name,
    goals: row.goals,
  }));
}

export async function getSeasonDisciplineSummary(
  seasonId: string
): Promise<DisciplineSummaryRow[]> {
  const rows = await callRpc<DisciplineRpcRow>(
    "get_season_discipline_summary",
    { p_season_id: seasonId }
  );
  return rows.map((row) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    seasonTeamId: row.season_team_id,
    teamName: row.team_name,
    yellowCards: row.yellow_cards,
    redCards: row.red_cards,
    activeSuspensions: row.active_suspensions,
    matchesRemaining: row.matches_remaining,
    suspensionStatus: row.suspension_status,
  }));
}

export async function getSeasonScoreMismatches(
  organizationId: string,
  seasonId: string
): Promise<ScoreMismatchRow[]> {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, home_season_team_id, away_season_team_id, home_score, away_score"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .in("status", ["finished", "walkover"])
    .not("home_score", "is", null)
    .not("away_score", "is", null);

  if (!matches || matches.length === 0) return [];

  const { data: seasonTeams } = await supabase
    .from("season_teams")
    .select("id, display_name, teams(name)")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  const names = new Map<string, string>();
  for (const row of seasonTeams ?? []) {
    const display = row.display_name?.trim();
    if (display) {
      names.set(row.id, display);
      continue;
    }
    const teams = row.teams as
      | { name: string }
      | { name: string }[]
      | null;
    const team = Array.isArray(teams) ? teams[0] : teams;
    names.set(row.id, team?.name ?? "Equipo");
  }

  const matchIds = matches.map((m) => m.id);
  const { data: events } = await supabase
    .from("match_events")
    .select("match_id, event_type, season_team_players(season_team_id)")
    .eq("organization_id", organizationId)
    .in("match_id", matchIds)
    .in("event_type", ["goal", "own_goal"]);

  const eventTotals = new Map<string, { home: number; away: number }>();
  for (const match of matches) {
    eventTotals.set(match.id, { home: 0, away: 0 });
  }

  const matchById = new Map(matches.map((m) => [m.id, m]));

  for (const event of events ?? []) {
    const totals = eventTotals.get(event.match_id);
    const match = matchById.get(event.match_id);
    if (!totals || !match) continue;

    const stp = event.season_team_players as
      | { season_team_id: string }
      | { season_team_id: string }[]
      | null;
    const seasonTeamId = Array.isArray(stp)
      ? stp[0]?.season_team_id
      : stp?.season_team_id;
    if (!seasonTeamId) continue;

    if (event.event_type === "goal") {
      if (seasonTeamId === match.home_season_team_id) totals.home += 1;
      if (seasonTeamId === match.away_season_team_id) totals.away += 1;
    } else if (event.event_type === "own_goal") {
      if (seasonTeamId === match.home_season_team_id) totals.away += 1;
      if (seasonTeamId === match.away_season_team_id) totals.home += 1;
    }
  }

  const mismatches: ScoreMismatchRow[] = [];
  for (const match of matches) {
    const officialHome = match.home_score ?? 0;
    const officialAway = match.away_score ?? 0;
    const fromEvents = eventTotals.get(match.id) ?? { home: 0, away: 0 };
    if (
      fromEvents.home !== officialHome ||
      fromEvents.away !== officialAway
    ) {
      mismatches.push({
        matchId: match.id,
        homeName: names.get(match.home_season_team_id) ?? "Local",
        awayName: names.get(match.away_season_team_id) ?? "Visitante",
        officialHome,
        officialAway,
        eventsHome: fromEvents.home,
        eventsAway: fromEvents.away,
      });
    }
  }

  return mismatches;
}

export async function getSeasonSlug(
  organizationId: string,
  seasonId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("slug")
    .eq("id", seasonId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data?.slug ?? null;
}

export async function getDashboardStandingsLeader(
  organizationId: string
): Promise<{
  seasonId: string;
  competitionId: string;
  seasonName: string;
  competitionName: string;
  teamName: string;
  points: number;
  played: number;
} | null> {
  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("id, name, competition_id, competitions(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) return null;

  const standings = await getSeasonStandings(season.id);
  const leader = standings[0];
  if (!leader || leader.played === 0) return null;

  const competitionRelation = season.competitions as
    | { name: string }
    | { name: string }[]
    | null;
  const competitionName = Array.isArray(competitionRelation)
    ? competitionRelation[0]?.name
    : competitionRelation?.name;

  return {
    seasonId: season.id,
    competitionId: season.competition_id,
    seasonName: season.name,
    competitionName: competitionName ?? "Torneo",
    teamName: leader.teamName,
    points: leader.points,
    played: leader.played,
  };
}

export async function getPublicSeasonsCount(
  organizationId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("seasons")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("visibility", "public");
  return count ?? 0;
}

export async function getRecentPublicSeasons(
  organizationId: string,
  limit = 3
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    competitionId: string;
    competitionName: string;
  }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, slug, competition_id, competitions(name)")
    .eq("organization_id", organizationId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const competitionRelation = row.competitions as
      | { name: string }
      | { name: string }[]
      | null;
    const competitionName = Array.isArray(competitionRelation)
      ? competitionRelation[0]?.name
      : competitionRelation?.name;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      competitionId: row.competition_id,
      competitionName: competitionName ?? "Torneo",
    };
  });
}
