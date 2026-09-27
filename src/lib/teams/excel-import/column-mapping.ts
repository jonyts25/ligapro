import { callAI, type CallAIResult } from "@/lib/ai/call-ai";
import type { ExcelImportField } from "@/lib/teams/excel-import/constants";
import { parseColumnMappingResponse } from "@/lib/teams/excel-import/parse-column-mapping-response";
import type { ExcelColumnMapping } from "@/lib/teams/excel-import/types";

const SYSTEM_PROMPT = `Eres un asistente que mapea columnas de hojas de cálculo a campos de un torneo de fútbol amateur.
Responde SOLO con un objeto JSON (sin markdown) con estas claves exactas:
- "equipo": nombre de columna que contiene el equipo, o null
- "jugador": nombre de columna que contiene el nombre del jugador, o null
- "dorsal": nombre de columna del número de camiseta, o null
- "telefono": nombre de columna de teléfono/WhatsApp, o null

Reglas:
- Usa los encabezados EXACTAMENTE como aparecen en la entrada.
- equipo y jugador son obligatorios; si no hay columna clara, usa null.
- dorsal y telefono son opcionales.`;

export function buildColumnMappingPrompt(
  headers: string[],
  sampleRows: string[][]
): string {
  const sample = sampleRows
    .map((row, index) => `${index + 1}. ${row.join(" | ")}`)
    .join("\n");

  return `Encabezados:
${headers.map((header) => `- ${header}`).join("\n")}

Primeras filas de ejemplo:
${sample || "(sin filas)"}`;
}

export function normalizeColumnMapping(
  mapping: ExcelColumnMapping,
  headers: string[]
): ExcelColumnMapping {
  const headerSet = new Set(headers);
  const normalized = { ...mapping };

  for (const key of Object.keys(normalized) as ExcelImportField[]) {
    const value = normalized[key];
    if (value && !headerSet.has(value)) {
      normalized[key] = null;
    }
  }

  return normalized;
}

export function validateRequiredColumnMapping(
  mapping: ExcelColumnMapping
): string | null {
  if (!mapping.equipo || !mapping.jugador) {
    return "No pudimos mapear automáticamente las columnas obligatorias Equipo y Jugador. Ajusta el mapeo manualmente.";
  }
  return null;
}

export async function proposeExcelColumnMapping(
  headers: string[],
  sampleRows: string[][],
  aiCall: (
    systemPrompt: string,
    userPrompt: string
  ) => Promise<CallAIResult> = callAI
): Promise<ExcelColumnMapping> {
  const { text, error } = await aiCall(SYSTEM_PROMPT, buildColumnMappingPrompt(headers, sampleRows));

  if (error) {
    throw new Error(error);
  }
  if (!text) {
    throw new Error("La IA no devolvió una propuesta de mapeo.");
  }

  const parsed = parseColumnMappingResponse(text);
  const normalized = normalizeColumnMapping(parsed, headers);
  const validationError = validateRequiredColumnMapping(normalized);
  if (validationError) {
    throw new Error(validationError);
  }

  return normalized;
}
