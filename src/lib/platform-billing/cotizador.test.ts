import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCotizacion,
  combinacionesRoundRobin,
  DEFAULT_COTIZADOR_INPUT,
  descuentoPortafolio,
  multiplicadorBandaCancha,
  partidosLiguilla,
  tierFromPartidosMes,
} from "@/lib/platform-billing/cotizador";

describe("cotizador por partido", () => {
  it("calculates round-robin combinations", () => {
    assert.equal(combinacionesRoundRobin(10), 45);
    assert.equal(combinacionesRoundRobin(1), 0);
  });

  it("calculates liguilla partidos", () => {
    assert.equal(partidosLiguilla("top4", false), 3);
    assert.equal(partidosLiguilla("top4", true), 4);
    assert.equal(partidosLiguilla("ninguna", true), 0);
  });

  it("assigns tier S for low volume", () => {
    const quote = calculateCotizacion({
      ...DEFAULT_COTIZADOR_INPUT,
      equipos: 6,
      vueltas: 1,
      liguilla: "ninguna",
      duracionMeses: 3,
    });
    assert.ok(quote);
    assert.equal(quote.internal.tier, "S");
    assert.equal(quote.internal.precioBaseMensual, 900);
  });

  it("applies cancha band and portfolio discount", () => {
    const quote = calculateCotizacion({
      equipos: 12,
      vueltas: 2,
      liguilla: "top4",
      partidoTercerLugar: false,
      duracionMeses: 6,
      costoCanchaPorPartido: 500,
      torneosActivosMes: 4,
    });
    assert.ok(quote);
    assert.equal(multiplicadorBandaCancha(500).mult, 1.15);
    assert.equal(descuentoPortafolio(4).pct, 0.08);
    const expectedBase = tierFromPartidosMes(quote.internal.partidosPorMes).precioBase;
    const withBanda = expectedBase * 1.15;
    assert.equal(quote.precioMensualFinal, withBanda * 0.92);
  });

  it("uses XL marginal formula above 70 partidos/mes", () => {
    const { tier, precioBase } = tierFromPartidosMes(85);
    assert.equal(tier, "XL");
    assert.equal(precioBase, 2000 + 15 * 20);
  });

  it("returns null for invalid input", () => {
    assert.equal(
      calculateCotizacion({ ...DEFAULT_COTIZADOR_INPUT, equipos: 1 }),
      null
    );
  });
});
