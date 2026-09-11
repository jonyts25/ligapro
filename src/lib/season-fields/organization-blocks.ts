export type OrganizationSeasonFieldBlock = {
  id: string;
  fieldId: string;
  seasonId: string;
  seasonName: string;
  competitionId: string;
  competitionName: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

type RawSeasonFieldBlockRow = {
  id: string;
  field_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  season_id: string;
  seasons:
    | {
        name: string;
        competition_id: string;
        competitions: { name: string } | { name: string }[] | null;
      }
    | {
        name: string;
        competition_id: string;
        competitions: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

/** Maps season_field_blocks rows (same source as setSeasonFieldBlocks validation). */
export function normalizeOrganizationSeasonFieldBlocks(
  rows: RawSeasonFieldBlockRow[]
): OrganizationSeasonFieldBlock[] {
  return rows.map((row) => {
    const seasonRel = row.seasons;
    const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
    const competitionRel = season?.competitions;
    const competition = Array.isArray(competitionRel)
      ? competitionRel[0]
      : competitionRel;

    return {
      id: row.id,
      fieldId: row.field_id,
      seasonId: row.season_id,
      seasonName: season?.name ?? "Torneo",
      competitionId: season?.competition_id ?? "",
      competitionName: competition?.name ?? "Torneo",
      dayOfWeek: row.day_of_week,
      startsAt: normalizeTime(row.starts_at),
      endsAt: normalizeTime(row.ends_at),
    };
  });
}
