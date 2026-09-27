import { createClient } from "@/lib/supabase/server";
import type {
  MatchOfficialRole,
  MatchOfficialStatus,
} from "@/lib/matches/types";
import {
  buildMyOfficialMatchAssignments as buildCore,
  fetchMyOfficialMatchAssignments,
  type MyOfficialMatchAssignmentCore,
} from "../shared/my-official-match-assignments";

export type MyOfficialMatchAssignment = Omit<
  MyOfficialMatchAssignmentCore,
  "officialRole" | "assignmentStatus"
> & {
  officialRole: MatchOfficialRole;
  assignmentStatus: MatchOfficialStatus;
  captureHref: string;
};

type OfficialRow = {
  id: string;
  match_id: string;
  role: string;
  status: string;
  organization_id?: string;
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
  organization_id?: string;
  season_id: string;
  home_season_team_id: string;
  away_season_team_id: string;
  field_reservation_id: string | null;
  season: SeasonMeta;
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

function withCaptureHref(
  organizationId: string,
  rows: MyOfficialMatchAssignmentCore[]
): MyOfficialMatchAssignment[] {
  return rows.map((row) => ({
    ...row,
    officialRole: row.officialRole as MatchOfficialRole,
    assignmentStatus: row.assignmentStatus as MatchOfficialStatus,
    captureHref: `/organizaciones/${organizationId}/torneos/${row.competitionId}/temporadas/${row.seasonId}/partidos/${row.matchId}/captura`,
  }));
}

/** Pure builder for tests — adds web capture links. */
export function buildMyOfficialMatchAssignments(
  organizationId: string,
  officials: OfficialRow[],
  matches: MatchRow[],
  teamNames: Map<string, string>,
  reservations: Map<string, ReservationRow>
): MyOfficialMatchAssignment[] {
  const officialsWithOrg = officials.map((row) => ({
    ...row,
    organization_id: row.organization_id ?? organizationId,
  }));
  const matchesWithOrg = matches.map((row) => ({
    ...row,
    organization_id: row.organization_id ?? organizationId,
  }));

  return withCaptureHref(
    organizationId,
    buildCore(officialsWithOrg, matchesWithOrg, teamNames, reservations)
  );
}

export async function getMyOfficialMatchAssignments(
  organizationId: string,
  profileId: string
): Promise<MyOfficialMatchAssignment[]> {
  const supabase = await createClient();
  const rows = await fetchMyOfficialMatchAssignments(
    supabase,
    profileId,
    organizationId
  );
  return withCaptureHref(organizationId, rows);
}
