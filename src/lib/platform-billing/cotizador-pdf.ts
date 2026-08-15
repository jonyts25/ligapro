import { jsPDF } from "jspdf";
import { PLATFORM_NAME } from "@/lib/platform/config";
import {
  formatCotizadorMoneyPdf,
  formatQuoteDatePdf,
  sanitizePdfText,
  type CotizadorInput,
  type CotizadorResult,
} from "@/lib/platform-billing/cotizador";

export type CotizadorPdfInput = {
  quote: CotizadorResult;
  input: CotizadorInput;
  clientName?: string;
  quotedAt?: Date;
};

export function buildCotizadorPdf(input: CotizadorPdfInput): Uint8Array {
  const { quote, input: params, clientName } = input;
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
  y += 10;

  doc.setFontSize(10);
  const clientRows: Array<[string, string]> = [
    ["Equipos", String(params.teamCount)],
    ["Duracion (meses)", String(params.durationMonths)],
    ["Precio mensual", formatCotizadorMoneyPdf(quote.monthlyPrice)],
    ["Precio temporada", formatCotizadorMoneyPdf(quote.seasonPrice)],
    [
      "Precio por equipo (temporada)",
      formatCotizadorMoneyPdf(quote.pricePerTeamSeason),
    ],
  ];

  for (const [label, value] of clientRows) {
    doc.text(sanitizePdfText(label), 14, y);
    doc.text(value, 196, y, { align: "right" });
    y += 6;
  }

  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    sanitizePdfText(
      `Cotizacion hipotetica por volumen de partidos. Generada en ${PLATFORM_NAME}.`
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
