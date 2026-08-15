import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCotizacion,
  courtCostMultiplier,
  DEFAULT_COTIZADOR_INPUT,
  playoffMatches,
  portfolioDiscountRate,
  regularMatches,
  tierForMatchesPerMonth,
} from "@/lib/platform-billing/cotizador";

describe("cotizador por partido", () => {
  it("calculates regular matches for 8 teams single round", () => {
    assert.equal(regularMatches(8, 1), 28);
    assert.equal(regularMatches(8, 2), 56);
  });

  it("calculates playoff matches with optional third place", () => {
    assert.equal(playoffMatches("none", false), 0);
    assert.equal(playoffMatches("top4", false), 3);
    assert.equal(playoffMatches("top4", true), 4);
    assert.equal(playoffMatches("top8", false), 7);
  });

  it("assigns tier S for low volume", () => {
    const tier = tierForMatchesPerMonth(15);
    assert.equal(tier.tier, "S");
    assert.equal(tier.basePrice, 900);
  });

  it("assigns tier XL with marginal pricing above 70", () => {
    const tier = tierForMatchesPerMonth(75);
    assert.equal(tier.tier, "XL");
    assert.equal(tier.basePrice, 2000 + 5 * 20);
  });

  it("applies court cost band and portfolio discount", () => {
    assert.equal(courtCostMultiplier(300), 1.0);
    assert.equal(courtCostMultiplier(450), 1.15);
    assert.equal(courtCostMultiplier(700), 1.3);
    assert.equal(portfolioDiscountRate(2), 0);
    assert.equal(portfolioDiscountRate(5), 0.12);
  });

  it("produces client-visible prices for a typical league", () => {
    const quote = calculateCotizacion({
      ...DEFAULT_COTIZADOR_INPUT,
      teamCount: 10,
      durationMonths: 5,
      courtCostPerMatch: 400,
      activeTournaments: 1,
    });

    assert.ok(quote);
    assert.ok(quote.monthlyPrice > 0);
    assert.ok(quote.seasonPrice > quote.monthlyPrice);
    assert.equal(
      quote.pricePerTeamSeason,
      quote.seasonPrice / 10
    );
    assert.equal(quote.internal.regularMatches, 45);
  });

  it("returns null for fewer than 2 teams", () => {
    assert.equal(
      calculateCotizacion({ ...DEFAULT_COTIZADOR_INPUT, teamCount: 1 }),
      null
    );
  });
});
