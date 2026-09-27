import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@ligapro/database";

import {
  matchOfficialRoleLabel,
  matchOfficialStatusLabel,
  matchStatusLabel,
} from "./labels";

/** Misma forma operativa que usaría la ruta web mis-partidos (consulta RLS directa). */
export type MyMatchAssignment = {
  assignmentId: string;
  matchId: string;
  organizationId: string;
  role: string;
  roleLabel: string;
  assignmentStatus: string;
  assignmentStatusLabel: string;
  homeName: string;
  awayName: string;
  matchStatus: string;
  matchStatusLabel: string;
  startsAt: string | null;
  fieldName: string | null;
  venueName: string | null;
};

function seasonTeamDisplayName(row: {
  display_name: string | null;
  teams: { name: string } | { name: string }[] | null;
}): string {
  if (row.display_name?.trim()) {
    return row.display_name.trim();
  }
  const rel = row.teams;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return name ?? "Equipo";
}

export async function fetchMyMatches(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<{ data: MyMatchAssignment[]; error: string | null }> {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("match_officials")
    .select("id, role, status, match_id, organization_id, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (assignmentsError) {
    return { data: [], error: assignmentsError.message };
  }

  if (!assignments?.length) {
    return { data: [], error: null };
  }

  const matchIds = [...new Set(assignments.map((row) => row.match_id))];

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, season_id, organization_id, status, home_season_team_id, away_season_team_id, field_reservation_id",
    )
    .in("id", matchIds);

  if (matchesError) {
    return { data: [], error: matchesError.message };
  }

  const matchById = new Map((matches ?? []).map((row) => [row.id, row]));
  const seasonIds = [
    ...new Set((matches ?? []).map((row) => row.season_id)),
  ];
  const reservationIds = [
    ...new Set(
      (matches ?? [])
        .map((row) => row.field_reservation_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const teamNameBySeasonTeamId = new Map<string, string>();
  await Promise.all(
    seasonIds.map(async (seasonId) => {
      const orgId = (matches ?? []).find((m) => m.season_id === seasonId)
        ?.organization_id;
      if (!orgId) return;

      const { data: teams } = await supabase
        .from("season_teams")
        .select("id, display_name, teams(name)")
        .eq("organization_id", orgId)
        .eq("season_id", seasonId);

      for (const team of teams ?? []) {
        teamNameBySeasonTeamId.set(team.id, seasonTeamDisplayName(team));
      }
    }),
  );

  const scheduleByReservationId = new Map<
    string,
    { startsAt: string; fieldName: string | null; venueName: string | null }
  >();

  if (reservationIds.length) {
    const orgIds = [
      ...new Set((matches ?? []).map((row) => row.organization_id)),
    ];

    for (const orgId of orgIds) {
      const orgReservationIds = (matches ?? [])
        .filter(
          (row) =>
            row.organization_id === orgId && row.field_reservation_id != null,
        )
        .map((row) => row.field_reservation_id as string);

      if (!orgReservationIds.length) continue;

      const { data: reservations } = await supabase
        .from("field_reservations")
        .select(
          "id, starts_at, fields(name, venues(name))",
        )
        .eq("organization_id", orgId)
        .eq("status", "confirmed")
        .in("id", orgReservationIds);

      for (const reservation of reservations ?? []) {
        const fieldRel = reservation.fields as
          | {
              name: string;
              venues: { name: string } | { name: string }[] | null;
            }
          | {
              name: string;
              venues: { name: string } | { name: string }[] | null;
            }[]
          | null;
        const field = Array.isArray(fieldRel) ? fieldRel[0] : fieldRel;
        const venueRel = field?.venues ?? null;
        const venue = Array.isArray(venueRel) ? venueRel[0] : venueRel;

        scheduleByReservationId.set(reservation.id, {
          startsAt: reservation.starts_at,
          fieldName: field?.name ?? null,
          venueName: venue?.name ?? null,
        });
      }
    }
  }

  const results: MyMatchAssignment[] = [];

  for (const assignment of assignments) {
    const match = matchById.get(assignment.match_id);
    if (!match) continue;

    const schedule = match.field_reservation_id
      ? scheduleByReservationId.get(match.field_reservation_id)
      : undefined;

    results.push({
      assignmentId: assignment.id,
      matchId: match.id,
      organizationId: assignment.organization_id,
      role: assignment.role,
      roleLabel: matchOfficialRoleLabel(assignment.role),
      assignmentStatus: assignment.status,
      assignmentStatusLabel: matchOfficialStatusLabel(assignment.status),
      homeName: teamNameBySeasonTeamId.get(match.home_season_team_id) ?? "Local",
      awayName:
        teamNameBySeasonTeamId.get(match.away_season_team_id) ?? "Visitante",
      matchStatus: match.status,
      matchStatusLabel: matchStatusLabel(match.status),
      startsAt: schedule?.startsAt ?? null,
      fieldName: schedule?.fieldName ?? null,
      venueName: schedule?.venueName ?? null,
    });
  }

  return { data: results, error: null };
}
