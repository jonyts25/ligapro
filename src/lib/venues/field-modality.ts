import type { TournamentModality } from "@/lib/competitions/tournament-type-presets";

export type FieldModality = TournamentModality;

export const FIELD_MODALITY_OPTIONS: Array<{
  value: FieldModality;
  label: string;
}> = [
  { value: "futbol_11", label: "Fútbol 11" },
  { value: "futbol_7", label: "Fútbol 7" },
  { value: "futbol_5_futsal", label: "Fútbol 5 / Futsal" },
];

export function fieldModalityLabel(
  modality: string | null | undefined
): string | null {
  if (!modality) return null;
  return (
    FIELD_MODALITY_OPTIONS.find((option) => option.value === modality)?.label ??
    modality
  );
}

export function parseFieldModality(raw: string): FieldModality | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return FIELD_MODALITY_OPTIONS.some((option) => option.value === trimmed)
    ? (trimmed as FieldModality)
    : null;
}

export function parseHourlyRate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}
