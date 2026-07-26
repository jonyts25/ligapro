import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PdfTableExport = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export function buildTablePdf(input: PdfTableExport): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(input.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(input.subtitle, 14, 22);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 28,
    head: [input.headers],
    body: input.rows.map((row) => row.map(String)),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [20, 33, 52] },
    theme: "grid",
  });

  return new Uint8Array(doc.output("arraybuffer"));
}
