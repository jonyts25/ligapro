import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCotizacion,
  DEFAULT_COTIZADOR_INPUT,
  sanitizePdfText,
} from "@/lib/platform-billing/cotizador";
import { buildCotizadorPdf } from "@/lib/platform-billing/cotizador-pdf";

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
  it("generates a non-empty PDF", () => {
    const quote = calculateCotizacion(DEFAULT_COTIZADOR_INPUT);
    assert.ok(quote);

    const bytes = buildCotizadorPdf({
      quote,
      clientName: "Cliente Demo",
    });
    assert.ok(bytes.byteLength > 500);
  });

  it("sanitizes client name for PDF", () => {
    const quote = calculateCotizacion(DEFAULT_COTIZADOR_INPUT);
    assert.ok(quote);
    const bytes = buildCotizadorPdf({
      quote,
      clientName: 'Liga "Cliente" — Demo',
    });
    const decoded = new TextDecoder("latin1").decode(bytes);
    assert.doesNotMatch(decoded, UNSAFE_CHARS);
  });
});
