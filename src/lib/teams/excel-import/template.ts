import ExcelJS from "exceljs";
import { EXCEL_IMPORT_TEMPLATE_HEADERS } from "@/lib/teams/excel-import/constants";

export async function buildExcelImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plantilla");

  sheet.addRow([...EXCEL_IMPORT_TEMPLATE_HEADERS]);
  sheet.addRow(["Halcones", "Juan Pérez", "10", "5551234567"]);
  sheet.addRow(["Halcones", "María López", "7", ""]);
  sheet.addRow(["Leones", "Carlos Díaz", "1", "5559876543"]);

  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
