import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  parseCsvSpreadsheet,
  parseSpreadsheetFile,
  takeSampleRows,
} from "@/lib/teams/excel-import/parse-spreadsheet";

describe("parseCsvSpreadsheet", () => {
  it("parses headers and rows from csv text", () => {
    const parsed = parseCsvSpreadsheet(
      "Equipo,Jugador,Dorsal\nHalcones,Juan,10\nLeones,Ana,7"
    );

    assert.deepEqual(parsed.headers, ["Equipo", "Jugador", "Dorsal"]);
    assert.deepEqual(parsed.rows, [
      ["Halcones", "Juan", "10"],
      ["Leones", "Ana", "7"],
    ]);
  });
});

describe("parseSpreadsheetFile", () => {
  it("parses xlsx buffers", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Hoja1");
    sheet.addRow(["Equipo", "Jugador"]);
    sheet.addRow(["Halcones", "Juan"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const parsed = await parseSpreadsheetFile(buffer, "plantilla.xlsx");
    assert.deepEqual(parsed.headers, ["Equipo", "Jugador"]);
    assert.deepEqual(parsed.rows, [["Halcones", "Juan"]]);
  });
});

describe("takeSampleRows", () => {
  it("limits sample size", () => {
    const rows = Array.from({ length: 20 }, (_, index) => [`row-${index}`]);
    assert.equal(takeSampleRows(rows, 10).length, 10);
  });
});
