import { createClient } from "@/lib/supabase/server";
import {
  buildOrganizationPendingItems,
  type OrganizationPendingItems,
  type PendingDisputeSource,
  type PendingFinanceSource,
  type PendingMatchSource,
} from "@/lib/dashboard/pending-items-core";
import { displaySeasonTeamName } from "@/lib/teams/types";

const LOOKBACK_DAYS = 14;
const WINDOW_FORWARD_DAYS = 7;

function addDaysMs(fromMs: number, days: number): number {
  return fromMs + days * 24 * 60 * 60 * 1000;
}

function seasonTeamDisplayName(row: {
  display_name: string | null;
  teams: { name: string } | { name: string }[] | null;
}): string {
  const rel = row.teams;
  const teamName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return displaySeasonTeamName(row.display_name, teamName ?? "Equipo");
}

export async function getOrganizationPendingItems(
  organizationId: string,
  options: { canManage: boolean; now?: Date }
): Promise<OrganizationPendingItems | null> {
  if (!options.canManage) {
    return null;
  }

  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const windowStartMs = addDaysMs(nowMs, -LOOKBACK_DAYS);
  const windowEndMs = addDaysMs(nowMs, WINDOW_FORWARD_DAYS);
  const windowStartIso = new Date(windowStartMs).toISOString();
  const windowEndIso = new Date(windowEndMs).toISOString();

  const supabase = await createClient();

  const [
    { data: reservationRows },
    { data: approvalRows },
    { data: disputeRows },
    { data: financeRows },
    { data: confirmedReferees },
  ] = await Promise.all([
    supabase
      .from("field_reservations")
      .select(
        `
        starts_at,
        matches!inner(
          id,
          status,
          result_approved_at,
          season_id,
          home_season_team_id,
          away_season_team_id,
          seasons!inner(
            id,
            name,
            competition_id,
            visibility,
            season_rules(match_duration_minutes)
          ),
          home:season_teams!matches_home_season_team_id_fkey(display_name, teams(name)),
          away:season_teams!matches_away_season_team_id_fkey(display_name, teams(name))
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("status", "confirmed")
      .eq("reservation_type", "match")
      .not("match_id", "is", null)
      .gte("starts_at", windowStartIso)
      .lte("starts_at", windowEndIso),
    supabase
      .from("matches")
      .select(
        `
        id,
        status,
        result_approved_at,
        season_id,
        home_season_team_id,
        away_season_team_id,
        seasons!inner(id, name, competition_id, visibility, season_rules(match_duration_minutes)),
        home:season_teams!matches_home_season_team_id_fkey(display_name, teams(name)),
        away:season_teams!matches_away_season_team_id_fkey(display_name, teams(name)),
        field_reservations(starts_at, status)
      `
      )
      .eq("organization_id", organizationId)
      .in("status", ["finished", "walkover"])
      .is("result_approved_at", null),
    supabase
      .from("match_result_disputes")
      .select(
        `
        id,
        reason,
        match_id,
        matches!inner(
          id,
          season_id,
          home_season_team_id,
          away_season_team_id,
          seasons!inner(id, competition_id, visibility),
          home:season_teams!matches_home_season_team_id_fkey(display_name, teams(name)),
          away:season_teams!matches_away_season_team_id_fkey(display_name, teams(name))
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("status", "open"),
    supabase
      .from("season_team_financial_summary")
      .select("season_team_id, balance_due")
      .eq("organization_id", organizationId)
      .gt("balance_due", 0),
    supabase
      .from("match_officials")
      .select("match_id")
      .eq("organization_id", organizationId)
      .eq("role", "referee")
      .eq("status", "confirmed"),
  ]);

  const confirmedRefereeMatchIds = new Set(
    (confirmedReferees ?? []).map((row) => row.match_id)
  );

  const openDisputeMatchIds = new Set(
    (disputeRows ?? []).map((row) => row.match_id)
  );

  const matchMap = new Map<string, PendingMatchSource>();

  function upsertMatchSource(source: PendingMatchSource) {
    matchMap.set(source.matchId, source);
  }

  for (const row of reservationRows ?? []) {
    const match = row.matches as {
      id: string;
      status: string;
      result_approved_at: string | null;
      season_id: string;
      home_season_team_id: string;
      away_season_team_id: string;
      seasons: {
        id: string;
        name: string;
        competition_id: string;
        visibility: string;
        season_rules: { match_duration_minutes: number | null } | null;
      };
      home: { display_name: string | null; teams: { name: string } | null };
      away: { display_name: string | null; teams: { name: string } | null };
    };

    if (match.seasons.visibility === "archived") continue;

    upsertMatchSource({
      matchId: match.id,
      seasonId: match.season_id,
      competitionId: match.seasons.competition_id,
      seasonName: match.seasons.name,
      homeTeamName: seasonTeamDisplayName(match.home),
      awayTeamName: seasonTeamDisplayName(match.away),
      startsAt: row.starts_at,
      status: match.status,
      hasConfirmedReferee: confirmedRefereeMatchIds.has(match.id),
      hasOpenDispute: openDisputeMatchIds.has(match.id),
      isResultOfficial: match.result_approved_at != null,
      matchDurationMinutes:
        match.seasons.season_rules?.match_duration_minutes ?? 90,
    });
  }

  for (const match of approvalRows ?? []) {
    const season = match.seasons as {
      id: string;
      name: string;
      competition_id: string;
      visibility: string;
      season_rules: { match_duration_minutes: number | null } | null;
    };
    if (season.visibility === "archived") continue;
    if (openDisputeMatchIds.has(match.id)) continue;

    const reservations = match.field_reservations as
      | Array<{ starts_at: string; status: string }>
      | { starts_at: string; status: string }
      | null;
    const reservationList = Array.isArray(reservations)
      ? reservations
      : reservations
        ? [reservations]
        : [];
    const confirmedReservation = reservationList.find(
      (reservation) => reservation.status === "confirmed"
    );

    upsertMatchSource({
      matchId: match.id,
      seasonId: match.season_id,
      competitionId: season.competition_id,
      seasonName: season.name,
      homeTeamName: seasonTeamDisplayName(
        match.home as { display_name: string | null; teams: { name: string } | null }
      ),
      awayTeamName: seasonTeamDisplayName(
        match.away as { display_name: string | null; teams: { name: string } | null }
      ),
      startsAt: confirmedReservation?.starts_at ?? null,
      status: match.status,
      hasConfirmedReferee: confirmedRefereeMatchIds.has(match.id),
      hasOpenDispute: false,
      isResultOfficial: false,
      matchDurationMinutes: season.season_rules?.match_duration_minutes ?? 90,
    });
  }

  const disputes: PendingDisputeSource[] = [];
  for (const row of disputeRows ?? []) {
    const match = row.matches as {
      id: string;
      season_id: string;
      seasons: { competition_id: string; visibility: string };
      home: { display_name: string | null; teams: { name: string } | null };
      away: { display_name: string | null; teams: { name: string } | null };
    };

    if (match.seasons.visibility === "archived") continue;

    disputes.push({
      disputeId: row.id,
      matchId: match.id,
      seasonId: match.season_id,
      competitionId: match.seasons.competition_id,
      homeTeamName: seasonTeamDisplayName(match.home),
      awayTeamName: seasonTeamDisplayName(match.away),
      reason: row.reason,
    });
  }

  const financeTeamIds = (financeRows ?? [])
    .map((row) => row.season_team_id)
    .filter((id): id is string => Boolean(id));
  const { data: financeTeamRows } =
    financeTeamIds.length > 0
      ? await supabase
          .from("season_teams")
          .select(
            "id, display_name, season_id, teams(name), seasons(id, name, competition_id, visibility)"
          )
          .eq("organization_id", organizationId)
          .in("id", financeTeamIds)
      : { data: [] };

  const financeTeamById = new Map(
    (financeTeamRows ?? []).map((row) => [row.id, row])
  );

  const finance: PendingFinanceSource[] = [];
  for (const row of financeRows ?? []) {
    if (!row.season_team_id) continue;
    const seasonTeam = financeTeamById.get(row.season_team_id);
    if (!seasonTeam) continue;

    const season = seasonTeam.seasons as {
      id: string;
      name: string;
      competition_id: string;
      visibility: string;
    };
    if (season.visibility === "archived") continue;

    finance.push({
      seasonTeamId: row.season_team_id as string,
      seasonId: seasonTeam.season_id,
      competitionId: season.competition_id,
      seasonName: season.name,
      teamName: seasonTeamDisplayName(seasonTeam),
      balanceDue: Number(row.balance_due),
    });
  }

  return buildOrganizationPendingItems({
    organizationId,
    matches: [...matchMap.values()],
    disputes,
    financeRows: finance,
    nowMs,
    windowStartMs: nowMs,
    windowEndMs,
  });
}
