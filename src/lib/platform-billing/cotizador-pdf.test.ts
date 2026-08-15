import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCotizacion,
  DEFAULT_COTIZADOR_INPUT,
  sanitizePdfText,
} from "@/lib/platform-billing/cotizador";
import {
  buildCotizadorPdf,
  extractCotizadorPdfText,
} from "@/lib/platform-billing/cotizador-pdf";

const UNSAFE_CHARS = /[\u2264\u2265\u00D7\u2212\u2013\u2014\u00B7\u201C\u201D\u2018\u2019]/;

describe("sanitizePdfText", () => {
  it("replaces common unicode symbols with ASCII", () => {
    assert.equal(sanitizePdfText("≤ 3 meses"), "hasta  3 meses");
    assert.equal(sanitizePdfText("3–5 torneos"), "3-5 torneos");
    assert.equal(sanitizePdfText("×1.6"), "x1.6");
    assert.equal(sanitizePdfText("−$100"), "-$100");
    assert.equal(sanitizePdfText('"Cliente"'), '"Cliente"');
  });
});

describe("buildCotizadorPdf", () => {
  it("does not embed unsafe characters in generated output", () => {
    const quote = calculateCotizacion({
      ...DEFAULT_COTIZADOR_INPUT,
      teamCount: 8,
      durationMonths: 3,
    });

    assert.ok(quote);

    const pdfText = extractCotizadorPdfText({
      quote,
      input: DEFAULT_COTIZADOR_INPUT,
      clientName: 'Liga "Cliente" Demo',
      quotedAt: new Date("2026-07-27T12:00:00.000Z"),
    });

    assert.match(pdfText, /Precio mensual/);
    assert.match(pdfText, /Precio temporada/);
    assert.doesNotMatch(pdfText, UNSAFE_CHARS);

    const bytes = buildCotizadorPdf({
      quote,
      input: DEFAULT_COTIZADOR_INPUT,
      clientName: "Cliente Demo",
    });
    assert.ok(bytes.byteLength > 500);
  });
});
