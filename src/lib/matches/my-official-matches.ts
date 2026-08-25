import { isSeasonArchived } from "@/lib/competitions/season-visibility";
import { createClient } from "@/lib/supabase/server";
import type {
  MatchOfficialRole,
  MatchOfficialStatus,
} from "@/lib/matches/types";

export type MyOfficialMatchAssignment = {
  matchOfficialId: string;
  matchId: string;
  seasonId: string;
  competitionId: string;
  seasonName: string;
  competitionName: string;
  matchupLabel: string;
  startsAt: string | null;
  venueFieldLabel: string;
  officialRole: MatchOfficialRole;
  assignmentStatus: MatchOfficialStatus;
  captureHref: string;
};

type OfficialRow = {
  id: string;
  match_id: string;
  role: string;
  status: string;
};

type SeasonMeta = {
  id: string;
  competition_id: string;
  visibility: string;
  name: string;
  competitionName: string;
};

type MatchRow = {
  id: string;
  season_id: string;
  home_season_team_id: string;
  away_season_team_id: string;
  field_reservation_id: string | null;
  season: SeasonMeta;
};

type TeamRow = {
  id: string;
  display_name: string | null;
  teams: { name: string } | { name: string }[] | null;
};

type ReservationRow = {
  id: string;
  starts_at: string;
  fields:
    | {
        name: string;
        venues: { name: string } | { name: string }[] | null;
      }
    | {
        name: string;
        venues: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

function seasonTeamDisplayName(row: TeamRow): string {
  if (row.display_name?.trim()) return row.display_name.trim();
  const rel = row.teams;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return name ?? "Equipo";
}

function venueFieldLabelFromReservation(row: ReservationRow | undefined): string {
  if (!row) return "Sin programación";
  const fieldRel = row.fields;
  const field = Array.isArray(fieldRel) ? fieldRel[0] : fieldRel;
  const venueRel = field?.venues ?? null;
  const venue = Array.isArray(venueRel) ? venueRel[0] : venueRel;
  return [venue?.name, field?.name].filter(Boolean).join(" · ") || "Sin sede/cancha";
}

function parseSeasonRelation(
  seasons: unknown
): SeasonMeta | null {
  const row = Array.isArray(seasons) ? seasons[0] : seasons;
  if (!row || typeof row !== "object") return null;

  const season = row as {
    id: string;
    competition_id: string;
    visibility: string;
    name: string;
    competitions?: { name: string } | { name: string }[] | null;
  };

  const competitionRel = season.competitions;
  const competitionName = Array.isArray(competitionRel)
    ? competitionRel[0]?.name
    : competitionRel?.name;

  return {
    id: season.id,
    competition_id: season.competition_id,
    visibility: season.visibility,
    name: season.name,
    competitionName: competitionName ?? "Torneo",
  };
}

/** Pure builder — testable without Supabase. */
export function buildMyOfficialMatchAssignments(
  organizationId: string,
  officials: OfficialRow[],
  matches: MatchRow[],
  teamNames: Map<string, string>,
  reservations: Map<string, ReservationRow>
): MyOfficialMatchAssignment[] {
  if (!officials.length) return [];

  const matchById = new Map(matches.map((match) => [match.id, match]));
  const rows: MyOfficialMatchAssignment[] = [];

  for (const official of officials) {
    const match = matchById.get(official.match_id);
    if (!match || isSeasonArchived(match.season.visibility)) continue;

    const homeName = teamNames.get(match.home_season_team_id) ?? "Local";
    const awayName = teamNames.get(match.away_season_team_id) ?? "Visitante";
    const reservation = match.field_reservation_id
      ? reservations.get(match.field_reservation_id)
      : undefined;

    rows.push({
      matchOfficialId: official.id,
      matchId: match.id,
      seasonId: match.season.id,
      competitionId: match.season.competition_id,
      seasonName: match.season.name,
      competitionName: match.season.competitionName,
      matchupLabel: `${homeName} vs ${awayName}`,
      startsAt: reservation?.starts_at ?? null,
      venueFieldLabel: venueFieldLabelFromReservation(reservation),
      officialRole: official.role as MatchOfficialRole,
      assignmentStatus: official.status as MatchOfficialStatus,
      captureHref: `/organizaciones/${organizationId}/torneos/${match.season.competition_id}/temporadas/${match.season.id}/partidos/${match.id}/captura`,
    });
  }

  rows.sort((a, b) => {
    if (a.startsAt == null && b.startsAt == null) {
      return a.matchupLabel.localeCompare(b.matchupLabel, "es");
    }
    if (a.startsAt == null) return 1;
    if (b.startsAt == null) return -1;
    return a.startsAt.localeCompare(b.startsAt);
  });

  return rows;
}

export async function getMyOfficialMatchAssignments(
  organizationId: string,
  profileId: string
): Promise<MyOfficialMatchAssignment[]> {
  const supabase = await createClient();

  const { data: officials } = await supabase
    .from("match_officials")
    .select("id, match_id, role, status")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId);

  if (!officials?.length) return [];

  const matchIds = [...new Set(officials.map((row) => row.match_id))];

  const { data: rawMatches } = await supabase
    .from("matches")
    .select(
      "id, season_id, home_season_team_id, away_season_team_id, field_reservation_id, seasons!inner(id, competition_id, visibility, name, competitions(name))"
    )
    .eq("organization_id", organizationId)
    .in("id", matchIds);

  if (!rawMatches?.length) return [];

  const matches: MatchRow[] = [];
  for (const row of rawMatches) {
    const season = parseSeasonRelation(row.seasons);
    if (!season) continue;
    matches.push({
      id: row.id,
      season_id: row.season_id,
      home_season_team_id: row.home_season_team_id,
      away_season_team_id: row.away_season_team_id,
      field_reservation_id: row.field_reservation_id,
      season,
    });
  }

  if (!matches.length) return [];

  const teamIds = new Set<string>();
  const reservationIds = new Set<string>();
  for (const match of matches) {
    teamIds.add(match.home_season_team_id);
    teamIds.add(match.away_season_team_id);
    if (match.field_reservation_id) {
      reservationIds.add(match.field_reservation_id);
    }
  }

  const [{ data: teams }, { data: reservationRows }] = await Promise.all([
    supabase
      .from("season_teams")
      .select("id, display_name, teams(name)")
      .eq("organization_id", organizationId)
      .in("id", [...teamIds]),
    reservationIds.size
      ? supabase
          .from("field_reservations")
          .select("id, starts_at, fields(name, venues(name))")
          .eq("organization_id", organizationId)
          .in("id", [...reservationIds])
      : Promise.resolve({ data: [] as ReservationRow[] }),
  ]);

  const teamNames = new Map<string, string>();
  for (const team of (teams ?? []) as TeamRow[]) {
    teamNames.set(team.id, seasonTeamDisplayName(team));
  }

  const reservations = new Map<string, ReservationRow>();
  for (const row of (reservationRows ?? []) as ReservationRow[]) {
    reservations.set(row.id, row);
  }

  return buildMyOfficialMatchAssignments(
    organizationId,
    officials,
    matches,
    teamNames,
    reservations
  );
}
