import type { SeasonFormatType } from "@/lib/competitions/types";
import { SEASON_FORMAT_OPTIONS } from "@/lib/competitions/types";

function parseNonNegInt(raw: string, label: string): { value?: number; error?: string } {
  if (!/^-?\d+$/.test(raw.trim())) {
    return { error: `${label} debe ser un número entero.` };
  }
  const value = Number(raw);
  if (value < 0) return { error: `${label} no puede ser negativo.` };
  return { value };
}

function parsePositiveInt(raw: string, label: string): { value?: number; error?: string } {
  const parsed = parseNonNegInt(raw, label);
  if (parsed.error) return parsed;
  if ((parsed.value ?? 0) <= 0) {
    return { error: `${label} debe ser mayor que cero.` };
  }
  return parsed;
}

function isFormatType(value: string): value is SeasonFormatType {
  return SEASON_FORMAT_OPTIONS.some((option) => option.value === value);
}

export type InitialSeasonSetupParsed = {
  formatType: SeasonFormatType;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  allowDraws: boolean;
  matchDurationMinutes: number;
  minimumRestMinutes: number;
  yellowCardLimit: number;
  suspensionMatches: number;
  groupsAdvancePerGroup: number | null;
};

export function parseInitialSeasonSetup(formData: FormData): {
  values: Record<string, string | number | boolean | null>;
  fieldErrors: Record<string, string>;
  parsed: InitialSeasonSetupParsed | null;
} {
  const formatType = String(formData.get("formatType") ?? "round_robin");
  const values = {
    formatType,
    matchDurationMinutes: String(formData.get("matchDurationMinutes") ?? "90"),
    pointsWin: String(formData.get("pointsWin") ?? "3"),
    pointsDraw: String(formData.get("pointsDraw") ?? "1"),
    pointsLoss: String(formData.get("pointsLoss") ?? "0"),
    allowDraws: formData.get("allowDraws") === "on",
    minimumRestMinutes: String(formData.get("minimumRestMinutes") ?? "0"),
    yellowCardLimit: String(formData.get("yellowCardLimit") ?? "5"),
    suspensionMatches: String(formData.get("suspensionMatches") ?? "1"),
    groupsAdvancePerGroup: String(formData.get("groupsAdvancePerGroup") ?? ""),
  };

  const fieldErrors: Record<string, string> = {};

  if (!isFormatType(formatType)) {
    fieldErrors.formatType = "Selecciona un formato válido.";
  }

  const matchDuration = parsePositiveInt(
    values.matchDurationMinutes,
    "Duración del partido"
  );
  const pointsWin = parseNonNegInt(values.pointsWin, "Puntos por victoria");
  const pointsDraw = parseNonNegInt(values.pointsDraw, "Puntos por empate");
  const pointsLoss = parseNonNegInt(values.pointsLoss, "Puntos por derrota");
  const restMinutes = parseNonNegInt(
    values.minimumRestMinutes,
    "Descanso mínimo"
  );
  const yellowLimit = parsePositiveInt(
    values.yellowCardLimit,
    "Límite de amarillas"
  );
  const suspension = parsePositiveInt(
    values.suspensionMatches,
    "Partidos de suspensión"
  );

  if (matchDuration.error) fieldErrors.matchDurationMinutes = matchDuration.error;
  if (pointsWin.error) fieldErrors.pointsWin = pointsWin.error;
  if (pointsDraw.error) fieldErrors.pointsDraw = pointsDraw.error;
  if (pointsLoss.error) fieldErrors.pointsLoss = pointsLoss.error;
  if (restMinutes.error) fieldErrors.minimumRestMinutes = restMinutes.error;
  if (yellowLimit.error) fieldErrors.yellowCardLimit = yellowLimit.error;
  if (suspension.error) fieldErrors.suspensionMatches = suspension.error;

  let groupsAdvancePerGroup: number | null = null;
  if (formatType === "groups_knockout") {
    const raw = values.groupsAdvancePerGroup.trim();
    if (!raw) {
      fieldErrors.groupsAdvancePerGroup =
        "Indica cuántos equipos clasifican por grupo.";
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        fieldErrors.groupsAdvancePerGroup = "Debe ser un entero mayor que 0.";
      } else {
        groupsAdvancePerGroup = n;
      }
    }
  }

  if (
    pointsWin.value != null &&
    pointsDraw.value != null &&
    pointsLoss.value != null &&
    !(pointsWin.value >= pointsDraw.value && pointsDraw.value >= pointsLoss.value)
  ) {
    fieldErrors.pointsWin =
      "Los puntos deben cumplir: victoria ≥ empate ≥ derrota.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, parsed: null };
  }

  return {
    values,
    fieldErrors,
    parsed: {
      formatType: formatType as SeasonFormatType,
      pointsWin: pointsWin.value ?? 3,
      pointsDraw: pointsDraw.value ?? 1,
      pointsLoss: pointsLoss.value ?? 0,
      allowDraws: values.allowDraws,
      matchDurationMinutes: matchDuration.value ?? 90,
      minimumRestMinutes: restMinutes.value ?? 0,
      yellowCardLimit: yellowLimit.value ?? 5,
      suspensionMatches: suspension.value ?? 1,
      groupsAdvancePerGroup,
    },
  };
}
