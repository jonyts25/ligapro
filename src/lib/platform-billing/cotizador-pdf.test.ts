import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COTIZADOR_PARAMS,
  calculateCotizacion,
  durationBandLabelPdf,
  sanitizePdfText,
  volumeBandLabelPdf,
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

describe("durationBandLabelPdf", () => {
  it("uses hasta instead of less-than-or-equal", () => {
    assert.equal(durationBandLabelPdf("hasta_3"), "hasta 3 meses");
    assert.equal(durationBandLabelPdf("4_6"), "4-6 meses");
    assert.equal(durationBandLabelPdf("7_12"), "7-12 meses");
  });
});

describe("buildCotizadorPdf", () => {
  it("does not embed unsafe characters in generated output", () => {
    const quote = calculateCotizacion(
      [
        { id: "a", teamCount: 8, durationBand: "hasta_3" },
        { id: "b", teamCount: 10, durationBand: "4_6" },
        { id: "c", teamCount: 12, durationBand: "7_12" },
      ],
      DEFAULT_COTIZADOR_PARAMS
    );

    assert.ok(quote);

    const pdfText = extractCotizadorPdfText({
      quote,
      params: DEFAULT_COTIZADOR_PARAMS,
      clientName: 'Liga "Cliente" Demo',
      quotedAt: new Date("2026-07-27T12:00:00.000Z"),
    });

    assert.match(pdfText, /hasta 3 meses/);
    assert.match(pdfText, /4-6 meses/);
    assert.match(pdfText, /7-12 meses/);
    assert.match(pdfText, /3-5 torneos/);
    assert.doesNotMatch(pdfText, UNSAFE_CHARS);

    const bytes = buildCotizadorPdf({
      quote,
      params: DEFAULT_COTIZADOR_PARAMS,
      clientName: "Cliente Demo",
    });
    assert.ok(bytes.byteLength > 500);
  });

  it("uses ASCII volume band labels", () => {
    assert.equal(volumeBandLabelPdf(4), "3-5 torneos");
  });
});
