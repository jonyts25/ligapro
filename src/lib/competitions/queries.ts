import { createClient } from "@/lib/supabase/server";
import { getOrganizationVenueStats } from "@/lib/venues/queries";
import { getSeasonRosterStats } from "@/lib/teams/queries";
import type {
  CompetitionDetail,
  CompetitionListItem,
  CompetitionRecord,
  SeasonDetail,
  SeasonListItem,
  SeasonPreparationLabel,
  SeasonRecord,
  SeasonRulesRecord,
  SeasonFormatType,
  SeasonVisibility,
} from "@/lib/competitions/types";

function preparationLabel(
  teamCount: number,
  activePlayerCount: number
): SeasonPreparationLabel {
  if (teamCount === 0) return "Pendiente de equipos";
  if (activePlayerCount === 0) return "Configurando planteles";
  return "Lista para generar fixture";
}

function mapSeason(row: {
  id: string;
  competition_id: string;
  organization_id: string;
  name: string;
  slug: string;
  format_type: string;
  visibility: string;
  starts_on: string | null;
  ends_on: string | null;
}): SeasonRecord {
  return {
    id: row.id,
    competition_id: row.competition_id,
    organization_id: row.organization_id,
    name: row.name,
    slug: row.slug,
    format_type: row.format_type as SeasonFormatType,
    visibility: row.visibility as SeasonVisibility,
    starts_on: row.starts_on,
    ends_on: row.ends_on,
  };
}

export async function getOrganizationCompetitions(
  organizationId: string
): Promise<{
  competitions: CompetitionListItem[];
  totalSeasons: number;
}> {
  const supabase = await createClient();

  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, organization_id, name")
    .eq("organization_id", organizationId)
    .order("name");

  const { data: seasons } = await supabase
    .from("seasons")
    .select(
      "id, competition_id, organization_id, name, slug, format_type, visibility, starts_on, ends_on, created_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const seasonIds = (seasons ?? []).map((s) => s.id);
  const teamCounts = new Map<string, number>();

  if (seasonIds.length > 0) {
    const { data: teams } = await supabase
      .from("season_teams")
      .select("season_id")
      .eq("organization_id", organizationId)
      .in("season_id", seasonIds);

    for (const team of teams ?? []) {
      teamCounts.set(
        team.season_id,
        (teamCounts.get(team.season_id) ?? 0) + 1
      );
    }
  }

  const seasonsByCompetition = new Map<string, SeasonListItem[]>();
  for (const season of seasons ?? []) {
    const item: SeasonListItem = {
      ...mapSeason(season),
      teamCount: teamCounts.get(season.id) ?? 0,
    };
    const list = seasonsByCompetition.get(season.competition_id) ?? [];
    list.push(item);
    seasonsByCompetition.set(season.competition_id, list);
  }

  const list: CompetitionListItem[] = (competitions ?? []).map((c) => {
    const competitionSeasons = seasonsByCompetition.get(c.id) ?? [];
    return {
      ...(c as CompetitionRecord),
      seasonCount: competitionSeasons.length,
      latestSeason: competitionSeasons[0] ?? null,
    };
  });

  return {
    competitions: list,
    totalSeasons: seasons?.length ?? 0,
  };
}

export async function getCompetitionWithSeasons(
  organizationId: string,
  competitionId: string
): Promise<CompetitionDetail | null> {
  const supabase = await createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, organization_id, name")
    .eq("id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!competition) return null;

  const { data: seasons } = await supabase
    .from("seasons")
    .select(
      "id, competition_id, organization_id, name, slug, format_type, visibility, starts_on, ends_on, created_at"
    )
    .eq("competition_id", competitionId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const seasonIds = (seasons ?? []).map((s) => s.id);
  const teamCounts = new Map<string, number>();

  if (seasonIds.length > 0) {
    const { data: teams } = await supabase
      .from("season_teams")
      .select("season_id")
      .eq("organization_id", organizationId)
      .in("season_id", seasonIds);

    for (const team of teams ?? []) {
      teamCounts.set(
        team.season_id,
        (teamCounts.get(team.season_id) ?? 0) + 1
      );
    }
  }

  return {
    ...(competition as CompetitionRecord),
    seasons: (seasons ?? []).map((s) => ({
      ...mapSeason(s),
      teamCount: teamCounts.get(s.id) ?? 0,
    })),
  };
}

export async function getSeasonDetails(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<SeasonDetail | null> {
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select(
      "id, competition_id, organization_id, name, slug, format_type, visibility, starts_on, ends_on, competitions(name)"
    )
    .eq("id", seasonId)
    .eq("competition_id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!season) return null;

  const { data: rules } = await supabase
    .from("season_rules")
    .select(
      "id, season_id, organization_id, points_win, points_draw, points_loss, allow_draws, match_duration_minutes, minimum_rest_minutes, yellow_card_limit, suspension_matches"
    )
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!rules) return null;

  const { count: teamCount } = await supabase
    .from("season_teams")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId);

  const [venueStats, rosterStats] = await Promise.all([
    getOrganizationVenueStats(organizationId),
    getSeasonRosterStats(organizationId, seasonId),
  ]);

  const competitionRelation = season.competitions as
    | { name: string }
    | { name: string }[]
    | null;
  const competitionName = Array.isArray(competitionRelation)
    ? competitionRelation[0]?.name
    : competitionRelation?.name;

  const teams = teamCount ?? 0;

  return {
    ...mapSeason(season),
    competitionName: competitionName ?? "Torneo",
    rules: rules as SeasonRulesRecord,
    teamCount: teams,
    readiness: {
      activeVenues: venueStats.activeVenues,
      effectiveActiveFields: venueStats.effectiveActiveFields,
      teamCount: teams,
      activePlayerCount: rosterStats.activePlayerCount,
      teamsWithCaptain: rosterStats.teamsWithCaptain,
      fixtureGenerated: false,
      scheduledMatches: 0,
      preparationLabel: preparationLabel(
        teams,
        rosterStats.activePlayerCount
      ),
    },
  };
}

export async function getOrganizationCompetitionStats(
  organizationId: string
): Promise<{ competitions: number; seasons: number }> {
  const supabase = await createClient();

  const { count: competitions } = await supabase
    .from("competitions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const { count: seasons } = await supabase
    .from("seasons")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return {
    competitions: competitions ?? 0,
    seasons: seasons ?? 0,
  };
}
