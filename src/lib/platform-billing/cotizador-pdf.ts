import { jsPDF } from "jspdf";
import { PLATFORM_NAME } from "@/lib/platform/config";
import {
  formatCotizadorMoneyPdf,
  formatQuoteDatePdf,
  sanitizePdfText,
  type CotizadorQuoteResult,
} from "@/lib/platform-billing/cotizador";

export type CotizadorPdfInput = {
  quote: CotizadorQuoteResult;
  clientName?: string;
  quotedAt?: Date;
};

export function buildCotizadorPdf(input: CotizadorPdfInput): Uint8Array {
  const { quote, clientName } = input;
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
  y += 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Precios para el cliente", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Mensual: ${formatCotizadorMoneyPdf(quote.precioMensualFinal)}`,
    14,
    y
  );
  y += 5;
  doc.text(
    `Temporada: ${formatCotizadorMoneyPdf(quote.precioTemporada)}`,
    14,
    y
  );
  y += 5;
  doc.text(
    `Por equipo (temporada): ${formatCotizadorMoneyPdf(quote.precioPorEquipoTemporada)}`,
    14,
    y
  );

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Desglose interno (staff)", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const internal = quote.internal;
  const lines = [
    `Partidos/mes: ${internal.partidosPorMes.toFixed(2)}`,
    `Tier: ${internal.tier}`,
    `Banda cancha: x${internal.multiplicadorBandaCancha.toFixed(2)}`,
    `Descuento portafolio: ${(internal.descuentoPortafolioPct * 100).toFixed(0)}%`,
  ];
  for (const line of lines) {
    doc.text(sanitizePdfText(line), 14, y);
    y += 5;
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

export function downloadCotizadorPdf(input: CotizadorPdfInput): void {
  const bytes = buildCotizadorPdf(input);
  const blob = new Blob([Buffer.from(bytes)]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cotizacion-${formatQuoteDatePdf(input.quotedAt ?? new Date())}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
