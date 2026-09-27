export type TournamentModality =
  | "futbol_11"
  | "futbol_7"
  | "futbol_5_futsal";

export type TournamentTypePreset = {
  modality: TournamentModality;
  label: string;
  playersOnField: number;
  halvesCount: number;
  matchDurationMinutes: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  allowDraws: boolean;
  minimumRestMinutes: number;
  yellowCardLimit: number;
  suspensionMatches: number;
  minRosterSize: number | null;
  maxRosterSize: number | null;
  updatedAt: string | null;
};

export type SeasonSetupFormPresetValues = {
  matchDurationMinutes: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  allowDraws: boolean;
  minimumRestMinutes: number;
  yellowCardLimit: number;
  suspensionMatches: number;
};

export const DEFAULT_SEASON_SETUP_FORM_VALUES: SeasonSetupFormPresetValues = {
  matchDurationMinutes: 90,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  allowDraws: true,
  minimumRestMinutes: 0,
  yellowCardLimit: 5,
  suspensionMatches: 1,
};

export function mapPresetRow(row: {
  modality: string;
  label: string;
  players_on_field: number;
  halves_count: number;
  match_duration_minutes: number;
  points_win: number;
  points_draw: number;
  points_loss: number;
  allow_draws: boolean;
  minimum_rest_minutes: number;
  yellow_card_limit: number;
  suspension_matches: number;
  min_roster_size: number | null;
  max_roster_size: number | null;
  updated_at: string | null;
}): TournamentTypePreset {
  return {
    modality: row.modality as TournamentModality,
    label: row.label,
    playersOnField: row.players_on_field,
    halvesCount: row.halves_count,
    matchDurationMinutes: row.match_duration_minutes,
    pointsWin: row.points_win,
    pointsDraw: row.points_draw,
    pointsLoss: row.points_loss,
    allowDraws: row.allow_draws,
    minimumRestMinutes: row.minimum_rest_minutes,
    yellowCardLimit: row.yellow_card_limit,
    suspensionMatches: row.suspension_matches,
    minRosterSize: row.min_roster_size,
    maxRosterSize: row.max_roster_size,
    updatedAt: row.updated_at,
  };
}

export function mapPresetToSeasonSetupFormValues(
  preset: TournamentTypePreset
): SeasonSetupFormPresetValues {
  return {
    matchDurationMinutes: preset.matchDurationMinutes,
    pointsWin: preset.pointsWin,
    pointsDraw: preset.pointsDraw,
    pointsLoss: preset.pointsLoss,
    allowDraws: preset.allowDraws,
    minimumRestMinutes: preset.minimumRestMinutes,
    yellowCardLimit: preset.yellowCardLimit,
    suspensionMatches: preset.suspensionMatches,
  };
}

export type ModalityPresetActionState = {
  ok: boolean;
  message: string | null;
};

export const initialModalityPresetActionState: ModalityPresetActionState = {
  ok: true,
  message: null,
};

export function seasonSetupValuesFromRecord(
  values: Record<string, string | number | boolean | null | undefined> | undefined,
  defaultMatchDurationMinutes = DEFAULT_SEASON_SETUP_FORM_VALUES.matchDurationMinutes
): SeasonSetupFormPresetValues {
  return {
    matchDurationMinutes: Number(
      values?.matchDurationMinutes ?? defaultMatchDurationMinutes
    ),
    pointsWin: Number(values?.pointsWin ?? DEFAULT_SEASON_SETUP_FORM_VALUES.pointsWin),
    pointsDraw: Number(
      values?.pointsDraw ?? DEFAULT_SEASON_SETUP_FORM_VALUES.pointsDraw
    ),
    pointsLoss: Number(
      values?.pointsLoss ?? DEFAULT_SEASON_SETUP_FORM_VALUES.pointsLoss
    ),
    allowDraws: Boolean(
      values?.allowDraws ?? DEFAULT_SEASON_SETUP_FORM_VALUES.allowDraws
    ),
    minimumRestMinutes: Number(
      values?.minimumRestMinutes ??
        DEFAULT_SEASON_SETUP_FORM_VALUES.minimumRestMinutes
    ),
    yellowCardLimit: Number(
      values?.yellowCardLimit ?? DEFAULT_SEASON_SETUP_FORM_VALUES.yellowCardLimit
    ),
    suspensionMatches: Number(
      values?.suspensionMatches ??
        DEFAULT_SEASON_SETUP_FORM_VALUES.suspensionMatches
    ),
  };
}
