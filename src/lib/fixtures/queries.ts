import { createClient } from "@/lib/supabase/server";
import {
  supportsAutoRoundRobin,
  FIXTURE_TIMEZONE,
  type ActiveFieldOption,
  type ActiveVenueOption,
  type EligibleSeasonTeam,
  type FieldAvailabilityInterval,
  type FixtureRoundGroup,
  type MatchListItem,
  type MatchSchedulingDetails,
  type MatchStatus,
  type OrganizationMatchStats,
  type SeasonFixtureContext,
  type SeasonFixtureStats,
} from "@/lib/fixtures/types";

function seasonTeamName(row: {
  display_name: string | null;
  teams:
    | { name: string }
    | { name: string }[]
    | null;
}): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  const rel = row.teams;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return name ?? "Equipo";
}

function mapMatchRow(
  row: {
    id: string;
    season_id: string;
    organization_id: string;
    round_number: number | null;
    leg_number: number | null;
    sequence_in_round: number | null;
    round_label: string | null;
    status: string;
    home_season_team_id: string;
    away_season_team_id: string;
    home_score: number | null;
    away_score: number | null;
    field_reservation_id: string | null;
  },
  names: Map<string, string>,
  reservations: Map<
    string,
    {
      id: string;
      field_id: string;
      starts_at: string;
      ends_at: string;
      fieldName: string | null;
      venueId: string | null;
      venueName: string | null;
      fieldIsActive: boolean | null;
      venueIsActive: boolean | null;
    }
  >
): MatchListItem {
  const res = row.field_reservation_id
    ? reservations.get(row.field_reservation_id)
    : undefined;

  return {
    id: row.id,
    seasonId: row.season_id,
    organizationId: row.organization_id,
    roundNumber: row.round_number,
    legNumber: row.leg_number,
    sequenceInRound: row.sequence_in_round,
    roundLabel: row.round_label,
    status: row.status as MatchStatus,
    homeSeasonTeamId: row.home_season_team_id,
    awaySeasonTeamId: row.away_season_team_id,
    homeName: names.get(row.home_season_team_id) ?? "Local",
    awayName: names.get(row.away_season_team_id) ?? "Visitante",
    homeScore: row.home_score,
    awayScore: row.away_score,
    isProgrammed: Boolean(row.field_reservation_id && res),
    schedule: {
      reservationId: res?.id ?? null,
      fieldId: res?.field_id ?? null,
      fieldName: res?.fieldName ?? null,
      venueId: res?.venueId ?? null,
      venueName: res?.venueName ?? null,
      startsAt: res?.starts_at ?? null,
      endsAt: res?.ends_at ?? null,
      fieldIsActive: res?.fieldIsActive ?? null,
      venueIsActive: res?.venueIsActive ?? null,
    },
  };
}

async function loadSeasonTeamNames(
  organizationId: string,
  seasonId: string
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_teams")
    .select("id, display_name, teams(name)")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.id, seasonTeamName(row));
  }
  return map;
}

async function loadReservations(
  organizationId: string,
  reservationIds: string[]
) {
  const map = new Map<
    string,
    {
      id: string;
      field_id: string;
      starts_at: string;
      ends_at: string;
      fieldName: string | null;
      venueId: string | null;
      venueName: string | null;
      fieldIsActive: boolean | null;
      venueIsActive: boolean | null;
    }
  >();

  if (!reservationIds.length) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("field_reservations")
    .select(
      "id, field_id, starts_at, ends_at, status, fields(name, is_active, venue_id, venues(name, is_active))"
    )
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .in("id", reservationIds);

  for (const row of data ?? []) {
    const fieldRel = row.fields as
      | {
          name: string;
          is_active: boolean;
          venue_id: string;
          venues:
            | { name: string; is_active: boolean }
            | { name: string; is_active: boolean }[]
            | null;
        }
      | {
          name: string;
          is_active: boolean;
          venue_id: string;
          venues:
            | { name: string; is_active: boolean }
            | { name: string; is_active: boolean }[]
            | null;
        }[]
      | null;

    const field = Array.isArray(fieldRel) ? fieldRel[0] : fieldRel;
    const venueRel = field?.venues ?? null;
    const venue = Array.isArray(venueRel) ? venueRel[0] : venueRel;

    map.set(row.id, {
      id: row.id,
      field_id: row.field_id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      fieldName: field?.name ?? null,
      venueId: field?.venue_id ?? null,
      venueName: venue?.name ?? null,
      fieldIsActive: field?.is_active ?? null,
      venueIsActive: venue?.is_active ?? null,
    });
  }

  return map;
}

export async function getSeasonFixtureStats(
  organizationId: string,
  seasonId: string
): Promise<SeasonFixtureStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("id, field_reservation_id")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  const totalMatches = data?.length ?? 0;
  const scheduledMatches =
    data?.filter((m) => m.field_reservation_id != null).length ?? 0;

  return {
    totalMatches,
    scheduledMatches,
    pendingMatches: totalMatches - scheduledMatches,
    fixtureGenerated: totalMatches > 0,
  };
}

export async function getSeasonFixtureContext(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<SeasonFixtureContext | null> {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select(
      "id, name, format_type, competition_id, organization_id, competitions(name)"
    )
    .eq("id", seasonId)
    .eq("organization_id", organizationId)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (!season) return null;

  const { data: rules } = await supabase
    .from("season_rules")
    .select("match_duration_minutes, minimum_rest_minutes")
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const { data: teams } = await supabase
    .from("season_teams")
    .select("id, display_name, registration_status, teams(name)")
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .in("registration_status", ["registered", "confirmed"])
    .order("created_at");

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId);

  const competitionRel = season.competitions as
    | { name: string }
    | { name: string }[]
    | null;
  const competitionName = Array.isArray(competitionRel)
    ? competitionRel[0]?.name
    : competitionRel?.name;

  const eligibleTeams: EligibleSeasonTeam[] = (teams ?? []).map((t) => ({
    seasonTeamId: t.id,
    name: seasonTeamName(t),
    registrationStatus: t.registration_status,
  }));

  const existingMatchCount = count ?? 0;
  const formatType = season.format_type;
  const supports = supportsAutoRoundRobin(formatType);
  const matchDurationMinutes = rules?.match_duration_minutes ?? 90;
  const minimumRestMinutes = rules?.minimum_rest_minutes ?? 0;

  return {
    organizationId,
    competitionId,
    competitionName: competitionName ?? "Torneo",
    seasonId,
    seasonName: season.name,
    formatType,
    supportsAutoFixture: supports,
    matchDurationMinutes,
    minimumRestMinutes,
    slotMinutes: matchDurationMinutes + minimumRestMinutes,
    eligibleTeams,
    existingMatchCount,
    canGenerate:
      supports && eligibleTeams.length >= 2 && existingMatchCount === 0,
  };
}

export async function getSeasonMatchesGroupedByRound(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<{
  seasonName: string;
  competitionName: string;
  eligibleTeams: EligibleSeasonTeam[];
  rounds: FixtureRoundGroup[];
  stats: SeasonFixtureStats;
} | null> {
  const ctx = await getSeasonFixtureContext(
    organizationId,
    competitionId,
    seasonId
  );
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, season_id, organization_id, round_number, leg_number, sequence_in_round, round_label, status, home_season_team_id, away_season_team_id, home_score, away_score, field_reservation_id"
    )
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .order("round_number", { ascending: true })
    .order("sequence_in_round", { ascending: true });

  const names = await loadSeasonTeamNames(organizationId, seasonId);
  const reservationIds = (matches ?? [])
    .map((m) => m.field_reservation_id)
    .filter((id): id is string => Boolean(id));
  const reservations = await loadReservations(organizationId, reservationIds);

  const mapped = (matches ?? []).map((m) =>
    mapMatchRow(m, names, reservations)
  );

  const byRound = new Map<number, MatchListItem[]>();
  for (const match of mapped) {
    const round = match.roundNumber ?? 0;
    const list = byRound.get(round) ?? [];
    list.push(match);
    byRound.set(round, list);
  }

  const eligibleIds = new Set(
    ctx.eligibleTeams.map((t) => t.seasonTeamId)
  );
  const nameById = new Map(
    ctx.eligibleTeams.map((t) => [t.seasonTeamId, t.name])
  );

  const rounds: FixtureRoundGroup[] = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([roundNumber, roundMatches]) => {
      const playing = new Set<string>();
      for (const m of roundMatches) {
        playing.add(m.homeSeasonTeamId);
        playing.add(m.awaySeasonTeamId);
      }
      const byeSeasonTeamIds = [...eligibleIds].filter(
        (id) => !playing.has(id)
      );
      return {
        roundNumber,
        legNumber: roundMatches[0]?.legNumber ?? null,
        matches: roundMatches,
        byeSeasonTeamIds,
        byeNames: byeSeasonTeamIds.map(
          (id) => nameById.get(id) ?? "Equipo"
        ),
      };
    });

  const stats = await getSeasonFixtureStats(organizationId, seasonId);

  return {
    seasonName: ctx.seasonName,
    competitionName: ctx.competitionName,
    eligibleTeams: ctx.eligibleTeams,
    rounds,
    stats,
  };
}

export async function getMatchSchedulingDetails(
  organizationId: string,
  competitionId: string,
  seasonId: string,
  matchId: string
): Promise<MatchSchedulingDetails | null> {
  const ctx = await getSeasonFixtureContext(
    organizationId,
    competitionId,
    seasonId
  );
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, season_id, organization_id, round_number, leg_number, sequence_in_round, round_label, status, home_season_team_id, away_season_team_id, home_score, away_score, field_reservation_id"
    )
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (!match) return null;

  const names = await loadSeasonTeamNames(organizationId, seasonId);
  const reservations = await loadReservations(
    organizationId,
    match.field_reservation_id ? [match.field_reservation_id] : []
  );

  return {
    match: mapMatchRow(match, names, reservations),
    seasonName: ctx.seasonName,
    competitionId,
    competitionName: ctx.competitionName,
    slotMinutes: ctx.slotMinutes,
    matchDurationMinutes: ctx.matchDurationMinutes,
    minimumRestMinutes: ctx.minimumRestMinutes,
  };
}

export async function getActiveVenuesAndFields(
  organizationId: string
): Promise<{
  venues: ActiveVenueOption[];
  fields: ActiveFieldOption[];
}> {
  const supabase = await createClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  const { data: fields } = await supabase
    .from("fields")
    .select("id, name, venue_id, is_active, venues(name, is_active)")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  const venueOptions: ActiveVenueOption[] = (venues ?? []).map((v) => ({
    id: v.id,
    name: v.name,
  }));

  const fieldOptions: ActiveFieldOption[] = [];
  for (const f of fields ?? []) {
    const venueRel = f.venues as
      | { name: string; is_active: boolean }
      | { name: string; is_active: boolean }[]
      | null;
    const venue = Array.isArray(venueRel) ? venueRel[0] : venueRel;
    if (!venue?.is_active) continue;
    fieldOptions.push({
      id: f.id,
      name: f.name,
      venueId: f.venue_id,
      venueName: venue.name,
      isActive: f.is_active,
      venueIsActive: venue.is_active,
    });
  }

  return { venues: venueOptions, fields: fieldOptions };
}

export async function getFieldAvailabilityForDate(
  organizationId: string,
  fieldId: string,
  dateISO: string
): Promise<FieldAvailabilityInterval[]> {
  const supabase = await createClient();

  const { data: field } = await supabase
    .from("fields")
    .select("id")
    .eq("id", fieldId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!field) return [];

  // dateISO = YYYY-MM-DD interpreted in Mexico City weekday
  const probe = new Date(`${dateISO}T12:00:00`);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: FIXTURE_TIMEZONE,
    weekday: "short",
  }).format(probe);
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dowMap[weekdayName];
  if (dayOfWeek === undefined) return [];

  const { data } = await supabase
    .from("field_availability_rules")
    .select("starts_at, ends_at")
    .eq("organization_id", organizationId)
    .eq("field_id", fieldId)
    .eq("day_of_week", dayOfWeek)
    .order("starts_at");

  return (data ?? []).map((r) => ({
    startsAt: String(r.starts_at).slice(0, 5),
    endsAt: String(r.ends_at).slice(0, 5),
  }));
}

export async function getOrganizationMatchStats(
  organizationId: string
): Promise<OrganizationMatchStats> {
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, season_id, field_reservation_id, home_season_team_id, away_season_team_id, seasons(competition_id)"
    )
    .eq("organization_id", organizationId)
    .limit(500);

  const totalMatches = matches?.length ?? 0;
  const scheduledMatches =
    matches?.filter((m) => m.field_reservation_id != null).length ?? 0;

  const reservationIds = (matches ?? [])
    .map((m) => m.field_reservation_id)
    .filter((id): id is string => Boolean(id));
  const reservations = await loadReservations(organizationId, reservationIds);

  const seasonIds = [...new Set((matches ?? []).map((m) => m.season_id))];
  const nameMaps = new Map<string, Map<string, string>>();
  await Promise.all(
    seasonIds.map(async (seasonId) => {
      nameMaps.set(
        seasonId,
        await loadSeasonTeamNames(organizationId, seasonId)
      );
    })
  );

  const now = Date.now();
  const upcoming = (matches ?? [])
    .map((m) => {
      if (!m.field_reservation_id) return null;
      const res = reservations.get(m.field_reservation_id);
      if (!res) return null;
      const starts = new Date(res.starts_at).getTime();
      if (Number.isNaN(starts) || starts < now) return null;
      const seasonRel = m.seasons as
        | { competition_id: string }
        | { competition_id: string }[]
        | null;
      const competitionId = Array.isArray(seasonRel)
        ? seasonRel[0]?.competition_id
        : seasonRel?.competition_id;
      const names = nameMaps.get(m.season_id);
      return {
        id: m.id,
        seasonId: m.season_id,
        competitionId: competitionId ?? "",
        homeName: names?.get(m.home_season_team_id) ?? "Local",
        awayName: names?.get(m.away_season_team_id) ?? "Visitante",
        startsAt: res.starts_at,
        venueName: res.venueName,
        fieldName: res.fieldName,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);

  return { totalMatches, scheduledMatches, upcoming };
}
