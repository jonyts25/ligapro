import type { ExcelColumnMapping } from "@/lib/teams/excel-import/types";
import { EXCEL_IMPORT_FIELDS } from "@/lib/teams/excel-import/constants";

type MappingJson = Partial<Record<string, unknown>>;

function readMappingFromParsed(parsed: MappingJson): ExcelColumnMapping | null {
  const mapping = {} as ExcelColumnMapping;
  for (const field of EXCEL_IMPORT_FIELDS) {
    const value = parsed[field];
    if (value == null || value === "") {
      mapping[field] = null;
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      mapping[field] = value.trim();
      continue;
    }
    return null;
  }
  return mapping;
}

export function parseColumnMappingResponse(raw: string): ExcelColumnMapping {
  const trimmed = raw.trim();

  try {
    const mapping = readMappingFromParsed(JSON.parse(trimmed) as MappingJson);
    if (mapping) return mapping;
  } catch {
    // Fall through to brace extraction.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const mapping = readMappingFromParsed(
        JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as MappingJson
      );
      if (mapping) return mapping;
    } catch {
      // Fall through to error below.
    }
  }

  throw new Error(
    "La respuesta de la IA no contiene JSON válido con las claves equipo, jugador, dorsal y telefono."
  );
}
