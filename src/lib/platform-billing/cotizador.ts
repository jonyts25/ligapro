export type LiguillaClasificados = "ninguna" | "top4" | "top8" | "top16";

export type CotizadorInput = {
  equipos: number;
  vueltas: 1 | 2;
  liguilla: LiguillaClasificados;
  partidoTercerLugar: boolean;
  duracionMeses: number;
  costoCanchaPorPartido: number;
  torneosActivosMes: number;
};

export const DEFAULT_COTIZADOR_INPUT: CotizadorInput = {
  equipos: 10,
  vueltas: 1,
  liguilla: "top4",
  partidoTercerLugar: false,
  duracionMeses: 6,
  costoCanchaPorPartido: 300,
  torneosActivosMes: 1,
};

export type CotizadorTier = "S" | "M" | "L" | "XL";

export type CotizadorInternalBreakdown = {
  partidosRegular: number;
  partidosLiguilla: number;
  partidosTotal: number;
  partidosPorMes: number;
  tier: CotizadorTier;
  precioBaseMensual: number;
  multiplicadorBandaCancha: number;
  bandaCanchaLabel: string;
  descuentoPortafolioPct: number;
  descuentoPortafolioLabel: string;
};

export type CotizadorQuoteResult = {
  precioMensualFinal: number;
  precioTemporada: number;
  precioPorEquipoTemporada: number;
  internal: CotizadorInternalBreakdown;
};

export function combinacionesRoundRobin(equipos: number): number {
  const n = Math.max(0, Math.floor(equipos));
  if (n < 2) return 0;
  return (n * (n - 1)) / 2;
}

export function partidosLiguilla(
  liguilla: LiguillaClasificados,
  partidoTercerLugar: boolean
): number {
  const clasificados =
    liguilla === "ninguna"
      ? 0
      : liguilla === "top4"
        ? 4
        : liguilla === "top8"
          ? 8
          : 16;

  if (clasificados <= 0) return 0;

  let partidos = clasificados - 1;
  if (partidoTercerLugar && clasificados >= 4) {
    partidos += 1;
  }
  return partidos;
}

export function tierFromPartidosMes(partidosMes: number): {
  tier: CotizadorTier;
  precioBase: number;
} {
  if (partidosMes <= 20) return { tier: "S", precioBase: 900 };
  if (partidosMes <= 40) return { tier: "M", precioBase: 1400 };
  if (partidosMes <= 70) return { tier: "L", precioBase: 2000 };
  return {
    tier: "XL",
    precioBase: 2000 + (partidosMes - 70) * 20,
  };
}

export function multiplicadorBandaCancha(costo: number): {
  mult: number;
  label: string;
} {
  if (costo <= 300) return { mult: 1.0, label: "≤ $300/partido" };
  if (costo <= 600) return { mult: 1.15, label: "$301–600/partido" };
  return { mult: 1.3, label: "$601+/partido" };
}

export function descuentoPortafolio(torneosActivos: number): {
  pct: number;
  label: string;
} {
  const n = Math.max(1, Math.floor(torneosActivos));
  if (n <= 2) return { pct: 0, label: "1–2 torneos" };
  if (n <= 4) return { pct: 0.08, label: "3–4 torneos" };
  if (n <= 7) return { pct: 0.12, label: "5–7 torneos" };
  return { pct: 0.15, label: "8–10 torneos" };
}

export function calculateCotizacion(
  input: CotizadorInput
): CotizadorQuoteResult | null {
  const equipos = Math.max(0, Math.floor(input.equipos));
  const meses = Math.max(0, Number(input.duracionMeses));
  if (equipos < 2 || meses <= 0) return null;

  const vueltas = input.vueltas === 2 ? 2 : 1;
  const partidosRegular = combinacionesRoundRobin(equipos) * vueltas;
  const partidosLig = partidosLiguilla(
    input.liguilla,
    input.partidoTercerLugar
  );
  const partidosTotal = partidosRegular + partidosLig;
  const partidosPorMes = partidosTotal / meses;

  const { tier, precioBase } = tierFromPartidosMes(partidosPorMes);
  const banda = multiplicadorBandaCancha(input.costoCanchaPorPartido);
  const portafolio = descuentoPortafolio(input.torneosActivosMes);

  const precioConBanda = precioBase * banda.mult;
  const precioMensualFinal = precioConBanda * (1 - portafolio.pct);
  const precioTemporada = precioMensualFinal * meses;
  const precioPorEquipoTemporada = precioTemporada / equipos;

  return {
    precioMensualFinal,
    precioTemporada,
    precioPorEquipoTemporada,
    internal: {
      partidosRegular,
      partidosLiguilla: partidosLig,
      partidosTotal,
      partidosPorMes,
      tier,
      precioBaseMensual: precioBase,
      multiplicadorBandaCancha: banda.mult,
      bandaCanchaLabel: banda.label,
      descuentoPortafolioPct: portafolio.pct,
      descuentoPortafolioLabel: portafolio.label,
    },
  };
}

export function formatCotizadorMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

const PDF_UNSAFE =
  /[\u2264\u2265\u00D7\u2212\u2013\u2014\u00B7\u201C\u201D\u2018\u2019\u00AB\u00BB\u2026]/g;

const PDF_REPLACEMENTS: Record<string, string> = {
  "\u2264": "hasta ",
  "\u2265": "desde ",
  "\u00D7": "x",
  "\u2212": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u00B7": ".",
  "\u201C": '"',
  "\u201D": '"',
  "\u2018": "'",
  "\u2019": "'",
  "\u00AB": '"',
  "\u00BB": '"',
  "\u2026": "...",
};

export function sanitizePdfText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(PDF_UNSAFE, (char) => PDF_REPLACEMENTS[char] ?? "")
    .replace(/[^\x20-\x7E\n\r\t]/g, "");
}

export function formatCotizadorMoneyPdf(amount: number): string {
  return sanitizePdfText(formatCotizadorMoney(amount));
}

export function formatQuoteDatePdf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
