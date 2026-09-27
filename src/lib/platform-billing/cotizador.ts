export type CotizadorInput = {
  teamCount: number;
  /** Torneos activos simultáneos del organizador (descuento por volumen). */
  activeTournaments: number;
};

export type CotizadorPricingParams = {
  basePricePerTournament: number;
  basePricePerTeam: number;
  volumeMultiplier1To2: number;
  volumeMultiplier3To5: number;
  volumeMultiplier6Plus: number;
};

export type CotizadorInternalBreakdown = {
  tournamentBase: number;
  teamSubtotal: number;
  subtotalBeforeVolume: number;
  volumeMultiplier: number;
  volumeBandLabel: string;
  volumeDiscountAmount: number;
};

export type CotizadorResult = {
  seasonPrice: number;
  pricePerTeamSeason: number;
  internal: CotizadorInternalBreakdown;
};

export const DEFAULT_COTIZADOR_INPUT: CotizadorInput = {
  teamCount: 8,
  activeTournaments: 1,
};

export const DEFAULT_COTIZADOR_PRICING: CotizadorPricingParams = {
  basePricePerTournament: 1500,
  basePricePerTeam: 200,
  volumeMultiplier1To2: 1.0,
  volumeMultiplier3To5: 0.9,
  volumeMultiplier6Plus: 0.8,
};

/** @deprecated Use CotizadorPricingParams — kept for set_platform_pricing_defaults RPC. */
export type CotizadorParams = CotizadorPricingParams & {
  durationMultiplierHasta3: number;
  durationMultiplier4To6: number;
  durationMultiplier7To12: number;
};

/** @deprecated */
export const DEFAULT_COTIZADOR_PARAMS: CotizadorParams = {
  ...DEFAULT_COTIZADOR_PRICING,
  durationMultiplierHasta3: 1.0,
  durationMultiplier4To6: 1.6,
  durationMultiplier7To12: 2.6,
};

export function volumeMultiplier(
  activeTournaments: number,
  params: CotizadorPricingParams
): number {
  const n = Math.max(1, Math.floor(activeTournaments));
  if (n <= 2) return params.volumeMultiplier1To2;
  if (n <= 5) return params.volumeMultiplier3To5;
  return params.volumeMultiplier6Plus;
}

export function volumeBandLabel(activeTournaments: number): string {
  const n = Math.max(1, Math.floor(activeTournaments));
  if (n <= 2) return "1–2 torneos activos";
  if (n <= 5) return "3–5 torneos activos";
  return "6+ torneos activos";
}

export function calculateCotizacion(
  input: CotizadorInput,
  pricing: CotizadorPricingParams = DEFAULT_COTIZADOR_PRICING
): CotizadorResult | null {
  const teams = Math.max(0, Math.floor(input.teamCount));
  if (teams < 1) return null;

  const tournamentBase = Math.max(0, pricing.basePricePerTournament);
  const teamSubtotal = Math.max(0, pricing.basePricePerTeam) * teams;
  const subtotalBeforeVolume = tournamentBase + teamSubtotal;
  const mult = volumeMultiplier(input.activeTournaments, pricing);
  const seasonPrice = subtotalBeforeVolume * mult;
  const pricePerTeamSeason = seasonPrice / teams;

  return {
    seasonPrice,
    pricePerTeamSeason,
    internal: {
      tournamentBase,
      teamSubtotal,
      subtotalBeforeVolume,
      volumeMultiplier: mult,
      volumeBandLabel: volumeBandLabel(input.activeTournaments),
      volumeDiscountAmount: subtotalBeforeVolume - seasonPrice,
    },
  };
}

export function formatCotizadorMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
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
