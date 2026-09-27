import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCotizacion,
  DEFAULT_COTIZADOR_INPUT,
  DEFAULT_COTIZADOR_PRICING,
  volumeMultiplier,
} from "@/lib/platform-billing/cotizador";
import { calculateCotizacionLegacyV2 } from "@/lib/platform-billing/cotizador-legacy-v2";

describe("cotizador por torneo y equipo", () => {
  it("calculates season price as base + per team", () => {
    const quote = calculateCotizacion(
      { teamCount: 10, activeTournaments: 1 },
      {
        basePricePerTournament: 1500,
        basePricePerTeam: 200,
        volumeMultiplier1To2: 1,
        volumeMultiplier3To5: 0.9,
        volumeMultiplier6Plus: 0.8,
      }
    );

    assert.ok(quote);
    assert.equal(quote.seasonPrice, 1500 + 200 * 10);
    assert.equal(quote.pricePerTeamSeason, quote.seasonPrice / 10);
  });

  it("applies volume multiplier for portfolio size", () => {
    assert.equal(
      volumeMultiplier(4, DEFAULT_COTIZADOR_PRICING),
      DEFAULT_COTIZADOR_PRICING.volumeMultiplier3To5
    );

    const quote = calculateCotizacion({
      ...DEFAULT_COTIZADOR_INPUT,
      teamCount: 8,
      activeTournaments: 4,
    });

    assert.ok(quote);
    assert.equal(
      quote.seasonPrice,
      (1500 + 200 * 8) * DEFAULT_COTIZADOR_PRICING.volumeMultiplier3To5
    );
  });

  it("returns null for zero teams", () => {
    assert.equal(
      calculateCotizacion({ ...DEFAULT_COTIZADOR_INPUT, teamCount: 0 }),
      null
    );
  });

  it("contrasts legacy monthly model vs per-tournament model", () => {
    const legacy = calculateCotizacionLegacyV2({
      teamCount: 10,
      rounds: 1,
      playoffBracket: "top4",
      thirdPlaceMatch: false,
      durationMonths: 6,
      courtCostPerMatch: 400,
      activeTournaments: 1,
    });

    const current = calculateCotizacion(
      { teamCount: 10, activeTournaments: 1 },
      DEFAULT_COTIZADOR_PRICING
    );

    assert.ok(legacy);
    assert.ok(current);
    assert.ok(legacy.monthlyPrice > 0);
    assert.ok(current.seasonPrice > 0);
    assert.notEqual(legacy.seasonPrice, current.seasonPrice);
  });
});
