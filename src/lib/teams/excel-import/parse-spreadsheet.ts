import ExcelJS from "exceljs";
import type { ParsedSpreadsheet } from "@/lib/teams/excel-import/types";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsvSpreadsheet(text: string): ParsedSpreadsheet {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0] ?? "");
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

export async function parseXlsxSpreadsheet(buffer: Buffer): Promise<ParsedSpreadsheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  const matrix: string[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as Array<string | number | null | undefined>;
    const cells = values.slice(1).map((value) => String(value ?? "").trim());
    if (cells.some(Boolean)) {
      matrix.push(cells);
    }
  });

  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: matrix[0] ?? [],
    rows: matrix.slice(1),
  };
}

export function isCsvFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".csv");
}

export async function parseSpreadsheetFile(
  buffer: Buffer,
  fileName: string
): Promise<ParsedSpreadsheet> {
  if (isCsvFileName(fileName)) {
    return parseCsvSpreadsheet(buffer.toString("utf8"));
  }

  return parseXlsxSpreadsheet(buffer);
}

export function takeSampleRows(rows: string[][], limit = 10): string[][] {
  return rows.slice(0, limit);
}
