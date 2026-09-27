import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCotizacion,
  DEFAULT_COTIZADOR_INPUT,
  DEFAULT_COTIZADOR_PRICING,
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
  });
});

describe("buildCotizadorPdf", () => {
  it("shows tournament breakdown without monthly price", () => {
    const quote = calculateCotizacion(
      { ...DEFAULT_COTIZADOR_INPUT, teamCount: 8 },
      DEFAULT_COTIZADOR_PRICING
    );

    assert.ok(quote);

    const pdfText = extractCotizadorPdfText({
      quote,
      input: DEFAULT_COTIZADOR_INPUT,
      clientName: "Cliente Demo",
      quotedAt: new Date("2026-07-27T12:00:00.000Z"),
    });

    assert.match(pdfText, /Base por torneo/);
    assert.match(pdfText, /Precio total del torneo/);
    assert.doesNotMatch(pdfText, /Precio mensual/);
    assert.doesNotMatch(pdfText, UNSAFE_CHARS);

    const bytes = buildCotizadorPdf({
      quote,
      input: DEFAULT_COTIZADOR_INPUT,
      clientName: "Cliente Demo",
    });
    assert.ok(bytes.byteLength > 500);
  });
});
