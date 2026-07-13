export const SEASON_FORMAT_OPTIONS = [
  { value: "round_robin", label: "Todos contra todos" },
  { value: "round_robin_double", label: "Todos contra todos (ida y vuelta)" },
  { value: "groups_knockout", label: "Grupos + eliminación" },
  { value: "knockout", label: "Eliminación directa" },
] as const;

export const SEASON_VISIBILITY_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "private", label: "Privada" },
  { value: "unlisted", label: "No listada" },
  { value: "public", label: "Pública" },
  { value: "archived", label: "Archivada" },
] as const;

export type SeasonFormatType =
  (typeof SEASON_FORMAT_OPTIONS)[number]["value"];
export type SeasonVisibility =
  (typeof SEASON_VISIBILITY_OPTIONS)[number]["value"];

export type CompetitionRecord = {
  id: string;
  organization_id: string;
  name: string;
};

export type SeasonRecord = {
  id: string;
  competition_id: string;
  organization_id: string;
  name: string;
  slug: string;
  format_type: SeasonFormatType;
  visibility: SeasonVisibility;
  starts_on: string | null;
  ends_on: string | null;
};

export type SeasonRulesRecord = {
  id: string;
  season_id: string;
  organization_id: string;
  points_win: number;
  points_draw: number;
  points_loss: number;
  allow_draws: boolean;
  match_duration_minutes: number;
  minimum_rest_minutes: number;
  yellow_card_limit: number;
  suspension_matches: number;
};

export type SeasonListItem = SeasonRecord & {
  teamCount: number;
};

export type CompetitionListItem = CompetitionRecord & {
  seasonCount: number;
  latestSeason: SeasonListItem | null;
};

export type SeasonPreparationLabel =
  | "Pendiente de equipos"
  | "Configurando planteles"
  | "Lista para generar fixture";

export type SeasonDetail = SeasonRecord & {
  competitionName: string;
  rules: SeasonRulesRecord;
  teamCount: number;
  readiness: {
    activeVenues: number;
    effectiveActiveFields: number;
    teamCount: number;
    activePlayerCount: number;
    teamsWithCaptain: number;
    fixtureGenerated: false;
    scheduledMatches: 0;
    preparationLabel: SeasonPreparationLabel;
  };
};

export type CompetitionDetail = CompetitionRecord & {
  seasons: SeasonListItem[];
};

export type CompetitionActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | number | boolean | null>;
};

export const initialCompetitionActionState: CompetitionActionState = {
  ok: false,
  message: null,
};

export function formatLabel(value: string): string {
  return (
    SEASON_FORMAT_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export function visibilityLabel(value: string): string {
  return (
    SEASON_VISIBILITY_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export function visibilityBadgeVariant(
  value: string
): "default" | "success" | "warning" | "info" {
  if (value === "public") return "success";
  if (value === "archived") return "warning";
  if (value === "draft") return "default";
  return "info";
}

export function slugifySeasonName(name: string): string {
  let slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) slug = "temporada";
  if (slug.length > 48) {
    slug = slug.slice(0, 48).replace(/-$/, "");
  }
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${slug}-${suffix}`;
}
