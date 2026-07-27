import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COTIZADOR_PARAMS,
  calculateCotizacion,
  calculateLineSubtotal,
  durationMultiplier,
  pricePerMonth,
  volumeMultiplier,
  volumeBandLabel,
} from "@/lib/platform-billing/cotizador";

const line = (id: string, teamCount: number, durationBand: "hasta_3" | "4_6" | "7_12") => ({
  id,
  teamCount,
  durationBand,
});

describe("cotizador", () => {
  it("calculates a single line without volume discount", () => {
    const quote = calculateCotizacion(
      [line("a", 10, "hasta_3")],
      DEFAULT_COTIZADOR_PARAMS
    );

    assert.ok(quote);
    assert.equal(quote.lines.length, 1);
    assert.equal(quote.lines[0].subtotal, 2000);
    assert.equal(quote.subtotalBeforeVolume, 2000);
    assert.equal(quote.volumeMultiplier, 1.0);
    assert.equal(quote.volumeDiscountAmount, 0);
    assert.equal(quote.finalTotal, 2000);
  });

  it("sums line subtotals and applies volume on combined total", () => {
    const quote = calculateCotizacion(
      [
        line("a", 8, "hasta_3"),
        line("b", 12, "4_6"),
        line("c", 6, "7_12"),
      ],
      DEFAULT_COTIZADOR_PARAMS
    );

    assert.ok(quote);
    const expectedSubtotal =
      8 * 200 * 1.0 + 12 * 200 * 1.6 + 6 * 200 * 2.6;
    assert.equal(quote.subtotalBeforeVolume, expectedSubtotal);
    assert.equal(quote.tournamentCount, 3);
    assert.equal(quote.volumeMultiplier, 0.9);
    assert.equal(quote.finalTotal, expectedSubtotal * 0.9);
    assert.equal(
      quote.volumeDiscountAmount,
      expectedSubtotal - expectedSubtotal * 0.9
    );
  });

  it("uses 6+ volume band when there are six tournaments", () => {
    const lines = Array.from({ length: 6 }, (_, index) =>
      line(String(index), 4, "hasta_3")
    );
    const quote = calculateCotizacion(lines, DEFAULT_COTIZADOR_PARAMS);

    assert.ok(quote);
    assert.equal(volumeMultiplier(6, DEFAULT_COTIZADOR_PARAMS), 0.8);
    assert.equal(volumeBandLabel(6), "6+ torneos");
    assert.equal(quote.volumeMultiplier, 0.8);
  });

  it("returns null when no valid lines exist", () => {
    assert.equal(
      calculateCotizacion([line("a", 0, "hasta_3")], DEFAULT_COTIZADOR_PARAMS),
      null
    );
  });

  it("respects custom params per line", () => {
    const params = {
      ...DEFAULT_COTIZADOR_PARAMS,
      basePricePerTeam: 150,
      durationMultiplierHasta3: 1.2,
    };

    assert.equal(durationMultiplier("hasta_3", params), 1.2);
    const subtotal = calculateLineSubtotal(line("a", 2, "hasta_3"), params);
    assert.ok(subtotal);
    assert.equal(subtotal.subtotal, 360);
  });

  it("keeps duration curve monotonic in total and decreasing per month", () => {
    const teams = 10;
    const sixMonths = calculateLineSubtotal(
      line("six", teams, "4_6"),
      DEFAULT_COTIZADOR_PARAMS
    );
    const twelveMonths = calculateLineSubtotal(
      line("twelve", teams, "7_12"),
      DEFAULT_COTIZADOR_PARAMS
    );

    assert.ok(sixMonths);
    assert.ok(twelveMonths);
    assert.ok(twelveMonths.subtotal > sixMonths.subtotal);
    assert.ok(
      pricePerMonth(twelveMonths.subtotal, "7_12") <
        pricePerMonth(sixMonths.subtotal, "4_6")
    );
  });
});
