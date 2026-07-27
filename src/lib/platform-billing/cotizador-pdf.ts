import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PLATFORM_NAME } from "@/lib/platform/config";
import {
  formatCotizadorMoney,
  type CotizadorParams,
  type CotizadorQuoteResult,
} from "@/lib/platform-billing/cotizador";

export type CotizadorPdfInput = {
  quote: CotizadorQuoteResult;
  params: CotizadorParams;
  clientName?: string;
  quotedAt?: Date;
};

function formatQuoteDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
  }).format(date);
}

export function buildCotizadorPdf(input: CotizadorPdfInput): Uint8Array {
  const { quote, params, clientName } = input;
  const quotedAt = input.quotedAt ?? new Date();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = 16;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(PLATFORM_NAME, 14, y);

  y += 8;
  doc.setFontSize(13);
  doc.text("Cotización de plataforma", 14, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Fecha: ${formatQuoteDate(quotedAt)}`, 14, y);

  if (clientName?.trim()) {
    y += 5;
    doc.text(`Cliente: ${clientName.trim()}`, 14, y);
  }

  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 6,
    head: [["Torneo", "Equipos", "Duración", "Mult. dur.", "Subtotal"]],
    body: quote.lines.map((line, index) => [
      `#${index + 1}`,
      String(line.teamCount),
      line.durationLabel,
      `×${line.durationMultiplier.toFixed(2)}`,
      formatCotizadorMoney(line.subtotal),
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [20, 33, 52] },
    theme: "grid",
  });

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY;
  y = (tableEnd ?? y + 40) + 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const summaryRows: Array<[string, string]> = [
    [
      "Total antes de descuento por volumen",
      formatCotizadorMoney(quote.subtotalBeforeVolume),
    ],
    [
      `Descuento por volumen (${quote.volumeBand}, ×${quote.volumeMultiplier.toFixed(2)})`,
      quote.volumeDiscountAmount > 0
        ? `−${formatCotizadorMoney(quote.volumeDiscountAmount)}`
        : formatCotizadorMoney(0),
    ],
  ];

  for (const [label, value] of summaryRows) {
    doc.text(label, 14, y);
    doc.text(value, 196, y, { align: "right" });
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total final", 14, y);
  doc.text(formatCotizadorMoney(quote.finalTotal), 196, y, { align: "right" });

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    `Precio base por equipo: ${formatCotizadorMoney(params.basePricePerTeam)} · Cotización hipotética generada en ${PLATFORM_NAME}.`,
    14,
    y,
    { maxWidth: 182 }
  );

  return new Uint8Array(doc.output("arraybuffer"));
}

export function downloadCotizadorPdf(input: CotizadorPdfInput): void {
  const bytes = buildCotizadorPdf(input);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const dateSlug = (input.quotedAt ?? new Date()).toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cotizacion-${dateSlug}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
