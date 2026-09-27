import type { ExcelImportField } from "@/lib/teams/excel-import/constants";

export type ParsedSpreadsheet = {
  headers: string[];
  rows: string[][];
};

export type ExcelColumnMapping = Record<ExcelImportField, string | null>;

export type MappedImportRow = {
  rowNumber: number;
  equipo: string;
  jugador: string;
  dorsal: number | null;
  telefono: string | null;
};

export type SkippedImportRow = {
  rowNumber: number;
  reason: string;
};

export type ExcelImportPreview = {
  headers: string[];
  mapping: ExcelColumnMapping;
  previewRows: MappedImportRow[];
  totalRowCount: number;
};

export type ExcelImportSummary = {
  teamsCreated: number;
  teamsEnrolled: number;
  playersCreated: number;
  skippedRows: SkippedImportRow[];
  warnings: string[];
};

export type ExcelImportActionState = {
  ok: boolean;
  message: string | null;
  preview?: ExcelImportPreview;
  summary?: ExcelImportSummary;
};

export const initialExcelImportActionState: ExcelImportActionState = {
  ok: false,
  message: null,
};
