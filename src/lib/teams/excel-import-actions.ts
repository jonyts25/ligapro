"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizationAdmin } from "@/lib/auth/require-organization-admin";
import { isAnthropicConfigured } from "@/lib/ai/call-ai";
import { applyColumnMapping } from "@/lib/teams/excel-import/apply-mapping";
import {
  normalizeColumnMapping,
  proposeExcelColumnMapping,
  validateRequiredColumnMapping,
} from "@/lib/teams/excel-import/column-mapping";
import {
  EXCEL_IMPORT_MAX_FILE_BYTES,
  YOUTH_TOURNAMENT_IMPORT_BLOCKED_MESSAGE,
} from "@/lib/teams/excel-import/constants";
import {
  parseSpreadsheetFile,
  takeSampleRows,
} from "@/lib/teams/excel-import/parse-spreadsheet";
import { runExcelImport } from "@/lib/teams/excel-import/run-import";
import type {
  ExcelColumnMapping,
  ExcelImportActionState,
} from "@/lib/teams/excel-import/types";
import { getSeasonMaxRosterSize } from "@/lib/teams/queries";
import { EXCEL_IMPORT_FIELDS } from "@/lib/teams/excel-import/constants";

async function loadSeasonYouthFlag(
  organizationId: string,
  competitionId: string,
  seasonId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("competitions(is_youth)")
    .eq("id", seasonId)
    .eq("competition_id", competitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const rel = season?.competitions as
    | { is_youth: boolean }
    | { is_youth: boolean }[]
    | null;
  const competition = Array.isArray(rel) ? rel[0] : rel;
  return competition?.is_youth ?? false;
}

function parseMappingFromFormData(formData: FormData): ExcelColumnMapping {
  const mapping = {} as ExcelColumnMapping;
  for (const field of EXCEL_IMPORT_FIELDS) {
    const raw = String(formData.get(`mapping_${field}`) ?? "").trim();
    mapping[field] = raw || null;
  }
  return mapping;
}

async function readUploadFile(formData: FormData): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Selecciona un archivo .xlsx o .csv.");
  }

  if (file.size > EXCEL_IMPORT_MAX_FILE_BYTES) {
    throw new Error(
      `El archivo supera el límite de ${Math.round(EXCEL_IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`
    );
  }

  const fileName = file.name.trim();
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
    throw new Error("Solo se admiten archivos .xlsx o .csv.");
  }

  const arrayBuffer = await file.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), fileName };
}

function revalidateSeasonTeamPaths(
  organizationId: string,
  competitionId: string,
  seasonId: string
) {
  const base = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}`;
  revalidatePath(`${base}/equipos`);
  revalidatePath(`${base}/equipos/inscribir`);
  revalidatePath(base);
}

export async function analyzeExcelImportAction(
  _prev: ExcelImportActionState,
  formData: FormData
): Promise<ExcelImportActionState> {
  try {
    const user = await requireUser();
    const organizationId = String(formData.get("organizationId") ?? "");
    const competitionId = String(formData.get("competitionId") ?? "");
    const seasonId = String(formData.get("seasonId") ?? "");

    await requireOrganizationAdmin(user.id, organizationId);

    if (await loadSeasonYouthFlag(organizationId, competitionId, seasonId)) {
      return { ok: false, message: YOUTH_TOURNAMENT_IMPORT_BLOCKED_MESSAGE };
    }

    if (!isAnthropicConfigured()) {
      return {
        ok: false,
        message:
          "La importación con IA requiere ANTHROPIC_API_KEY en el servidor. Descarga la plantilla y ajusta el mapeo manualmente cuando esté disponible.",
      };
    }

    const { buffer, fileName } = await readUploadFile(formData);
    const spreadsheet = await parseSpreadsheetFile(buffer, fileName);

    if (spreadsheet.headers.length === 0) {
      return { ok: false, message: "El archivo no tiene encabezados legibles." };
    }

    const sampleRows = takeSampleRows(spreadsheet.rows, 10);
    const mapping = await proposeExcelColumnMapping(
      spreadsheet.headers,
      sampleRows
    );

    const mappedPreview = applyColumnMapping(
      { headers: spreadsheet.headers, rows: sampleRows },
      mapping
    );

    return {
      ok: true,
      message: "Revisa el mapeo propuesto antes de importar.",
      preview: {
        headers: spreadsheet.headers,
        mapping,
        previewRows: mappedPreview,
        totalRowCount: spreadsheet.rows.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo analizar el archivo.",
    };
  }
}

export async function confirmExcelImportAction(
  _prev: ExcelImportActionState,
  formData: FormData
): Promise<ExcelImportActionState> {
  try {
    const user = await requireUser();
    const organizationId = String(formData.get("organizationId") ?? "");
    const competitionId = String(formData.get("competitionId") ?? "");
    const seasonId = String(formData.get("seasonId") ?? "");

    await requireOrganizationAdmin(user.id, organizationId);

    if (await loadSeasonYouthFlag(organizationId, competitionId, seasonId)) {
      return { ok: false, message: YOUTH_TOURNAMENT_IMPORT_BLOCKED_MESSAGE };
    }

    const mapping = normalizeColumnMapping(
      parseMappingFromFormData(formData),
      String(formData.get("headersJson") ?? "")
        .split("\u001f")
        .filter(Boolean)
    );

    const mappingError = validateRequiredColumnMapping(mapping);
    if (mappingError) {
      return { ok: false, message: mappingError };
    }

    const { buffer, fileName } = await readUploadFile(formData);
    const spreadsheet = await parseSpreadsheetFile(buffer, fileName);
    const mappedRows = applyColumnMapping(spreadsheet, mapping);

    if (mappedRows.length === 0) {
      return { ok: false, message: "El archivo no contiene filas para importar." };
    }

    const supabase = await createClient();
    const maxRosterSize = await getSeasonMaxRosterSize(organizationId, seasonId);
    const summary = await runExcelImport({
      supabase,
      organizationId,
      seasonId,
      rows: mappedRows,
      maxRosterSize,
    });

    revalidateSeasonTeamPaths(organizationId, competitionId, seasonId);

    const skippedText =
      summary.skippedRows.length > 0
        ? ` ${summary.skippedRows.length} fila(s) omitida(s).`
        : "";

    return {
      ok: true,
      message: `Importación completada: ${summary.teamsCreated} equipo(s) nuevo(s), ${summary.playersCreated} jugador(es) creado(s).${skippedText}`,
      summary,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo importar el archivo.",
    };
  }
}
