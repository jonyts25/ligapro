export const EXCEL_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;

export const EXCEL_IMPORT_ACCEPT =
  ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export const EXCEL_IMPORT_TEMPLATE_HEADERS = [
  "Equipo",
  "Jugador",
  "Dorsal",
  "Teléfono",
] as const;

export const EXCEL_IMPORT_FIELDS = [
  "equipo",
  "jugador",
  "dorsal",
  "telefono",
] as const;

export type ExcelImportField = (typeof EXCEL_IMPORT_FIELDS)[number];

export const EXCEL_IMPORT_FIELD_LABELS: Record<ExcelImportField, string> = {
  equipo: "Equipo",
  jugador: "Jugador",
  dorsal: "Dorsal",
  telefono: "Teléfono (opcional)",
};

export const YOUTH_TOURNAMENT_IMPORT_BLOCKED_MESSAGE =
  "La importación desde Excel no está disponible para torneos infantiles o juveniles (is_youth). Usa altas manuales o pega lista en cada plantel.";

export function parseHeadersFromPreview(headers: string[]): string {
  return headers.join("\u001f");
}

export function mappingFieldName(field: ExcelImportField): string {
  return `mapping_${field}`;
}
