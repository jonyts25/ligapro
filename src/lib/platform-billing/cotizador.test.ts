import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COTIZADOR_PARAMS,
  calculateCotizacion,
  durationMultiplier,
  volumeMultiplier,
  volumeBandLabel,
} from "@/lib/platform-billing/cotizador";

describe("cotizador", () => {
  it("applies default formula for a single short tournament", () => {
    const result = calculateCotizacion(
      { teamCount: 10, durationBand: "corta", tournamentCount: 1 },
      DEFAULT_COTIZADOR_PARAMS
    );

    assert.ok(result);
    assert.equal(result.pricePerTournament, 2000);
    assert.equal(result.totalPrice, 2000);
    assert.equal(result.durationMultiplier, 1.0);
    assert.equal(result.volumeMultiplier, 1.0);
  });

  it("applies long duration and volume discounts", () => {
    const result = calculateCotizacion(
      { teamCount: 8, durationBand: "larga", tournamentCount: 4 },
      DEFAULT_COTIZADOR_PARAMS
    );

    assert.ok(result);
    assert.equal(result.durationMultiplier, 1.6);
    assert.equal(result.volumeMultiplier, 0.9);
    assert.equal(result.pricePerTournament, 8 * 200 * 1.6 * 0.9);
    assert.equal(result.totalPrice, result.pricePerTournament * 4);
  });

  it("uses 6+ volume band", () => {
    assert.equal(volumeMultiplier(6, DEFAULT_COTIZADOR_PARAMS), 0.8);
    assert.equal(volumeBandLabel(6), "6+ torneos");
  });

  it("returns null for invalid counts", () => {
    assert.equal(
      calculateCotizacion(
        { teamCount: 0, durationBand: "corta", tournamentCount: 1 },
        DEFAULT_COTIZADOR_PARAMS
      ),
      null
    );
  });

  it("respects custom params", () => {
    const params = {
      ...DEFAULT_COTIZADOR_PARAMS,
      basePricePerTeam: 150,
      durationMultiplierShort: 1.2,
    };

    assert.equal(durationMultiplier("corta", params), 1.2);
    const result = calculateCotizacion(
      { teamCount: 2, durationBand: "corta", tournamentCount: 1 },
      params
    );
    assert.ok(result);
    assert.equal(result.pricePerTournament, 360);
  });
});
