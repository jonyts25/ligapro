import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PLATFORM_NAME } from "@/lib/platform/config";
import {
  durationBandLabelPdf,
  formatCotizadorMoneyPdf,
  formatQuoteDatePdf,
  sanitizePdfText,
  volumeBandLabelPdf,
  type CotizadorParams,
  type CotizadorQuoteResult,
} from "@/lib/platform-billing/cotizador";

export type CotizadorPdfInput = {
  quote: CotizadorQuoteResult;
  params: CotizadorParams;
  clientName?: string;
  quotedAt?: Date;
};

export function buildCotizadorPdf(input: CotizadorPdfInput): Uint8Array {
  const { quote, params, clientName } = input;
  const quotedAt = input.quotedAt ?? new Date();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = 16;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sanitizePdfText(PLATFORM_NAME), 14, y);

  y += 8;
  doc.setFontSize(13);
  doc.text("Cotizacion de plataforma", 14, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Fecha: ${formatQuoteDatePdf(quotedAt)}`, 14, y);

  if (clientName?.trim()) {
    y += 5;
    doc.text(`Cliente: ${sanitizePdfText(clientName.trim())}`, 14, y);
  }

  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 6,
    head: [["Torneo", "Equipos", "Duracion", "Mult. dur.", "Subtotal"]],
    body: quote.lines.map((line, index) => [
      `#${index + 1}`,
      String(line.teamCount),
      durationBandLabelPdf(line.durationBand),
      `x${line.durationMultiplier.toFixed(2)}`,
      formatCotizadorMoneyPdf(line.subtotal),
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

  const volumeBandPdf = volumeBandLabelPdf(quote.tournamentCount);
  const summaryRows: Array<[string, string]> = [
    [
      "Total antes de descuento por volumen",
      formatCotizadorMoneyPdf(quote.subtotalBeforeVolume),
    ],
    [
      `Descuento por volumen (${volumeBandPdf}, x${quote.volumeMultiplier.toFixed(2)})`,
      quote.volumeDiscountAmount > 0
        ? `-${formatCotizadorMoneyPdf(quote.volumeDiscountAmount)}`
        : formatCotizadorMoneyPdf(0),
    ],
  ];

  for (const [label, value] of summaryRows) {
    doc.text(sanitizePdfText(label), 14, y);
    doc.text(value, 196, y, { align: "right" });
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total final", 14, y);
  doc.text(formatCotizadorMoneyPdf(quote.finalTotal), 196, y, { align: "right" });

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    sanitizePdfText(
      `Precio base por equipo: ${formatCotizadorMoneyPdf(params.basePricePerTeam)}. Cotizacion hipotetica generada en ${PLATFORM_NAME}.`
    ),
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
  const dateSlug = formatQuoteDatePdf(input.quotedAt ?? new Date());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cotizacion-${dateSlug}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function extractCotizadorPdfText(input: CotizadorPdfInput): string {
  const bytes = buildCotizadorPdf(input);
  return new TextDecoder("latin1").decode(bytes);
}
