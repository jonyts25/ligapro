import type {
  ExcelColumnMapping,
  MappedImportRow,
  ParsedSpreadsheet,
} from "@/lib/teams/excel-import/types";

function headerIndex(headers: string[], headerName: string | null): number {
  if (!headerName) return -1;
  return headers.findIndex((header) => header === headerName);
}

function readCell(row: string[], index: number): string {
  if (index < 0) return "";
  return String(row[index] ?? "").trim();
}

function parseDorsal(raw: string): number | null {
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return value > 0 ? value : null;
}

export function applyColumnMapping(
  spreadsheet: ParsedSpreadsheet,
  mapping: ExcelColumnMapping
): MappedImportRow[] {
  const equipoIdx = headerIndex(spreadsheet.headers, mapping.equipo);
  const jugadorIdx = headerIndex(spreadsheet.headers, mapping.jugador);
  const dorsalIdx = headerIndex(spreadsheet.headers, mapping.dorsal);
  const telefonoIdx = headerIndex(spreadsheet.headers, mapping.telefono);

  return spreadsheet.rows.map((row, index) => ({
    rowNumber: index + 2,
    equipo: readCell(row, equipoIdx),
    jugador: readCell(row, jugadorIdx),
    dorsal: parseDorsal(readCell(row, dorsalIdx)),
    telefono: readCell(row, telefonoIdx) || null,
  }));
}
