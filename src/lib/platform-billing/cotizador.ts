export type PlayoffBracket = "none" | "top4" | "top8" | "top16";

export type CotizadorInput = {
  teamCount: number;
  rounds: 1 | 2;
  playoffBracket: PlayoffBracket;
  thirdPlaceMatch: boolean;
  durationMonths: number;
  courtCostPerMatch: number;
  activeTournaments: number;
};

export type CotizadorTier = "S" | "M" | "L" | "XL";

export type CotizadorInternalBreakdown = {
  regularMatches: number;
  playoffMatches: number;
  totalMatches: number;
  matchesPerMonth: number;
  tier: CotizadorTier;
  tierBasePrice: number;
  courtMultiplier: number;
  courtBandLabel: string;
  portfolioDiscountRate: number;
  portfolioBandLabel: string;
  priceBeforeCourtBand: number;
  priceAfterCourtBand: number;
  portfolioDiscountAmount: number;
};

export type CotizadorResult = {
  /** Visible al cliente */
  monthlyPrice: number;
  seasonPrice: number;
  pricePerTeamSeason: number;
  /** No mostrar al cliente */
  internal: CotizadorInternalBreakdown;
};

export const DEFAULT_COTIZADOR_INPUT: CotizadorInput = {
  teamCount: 8,
  rounds: 1,
  playoffBracket: "none",
  thirdPlaceMatch: false,
  durationMonths: 6,
  courtCostPerMatch: 250,
  activeTournaments: 1,
};

export function regularMatches(teamCount: number, rounds: 1 | 2): number {
  const teams = Math.max(0, Math.floor(teamCount));
  if (teams < 2) return 0;
  const singleRound = (teams * (teams - 1)) / 2;
  return singleRound * rounds;
}

export function playoffMatches(
  bracket: PlayoffBracket,
  thirdPlaceMatch: boolean
): number {
  const classified =
    bracket === "none"
      ? 0
      : bracket === "top4"
        ? 4
        : bracket === "top8"
          ? 8
          : 16;
  if (classified === 0) return 0;
  let matches = classified - 1;
  if (thirdPlaceMatch && classified >= 4) matches += 1;
  return matches;
}

export function courtCostMultiplier(costPerMatch: number): number {
  const cost = Math.max(0, costPerMatch);
  if (cost <= 300) return 1.0;
  if (cost <= 600) return 1.15;
  return 1.3;
}

export function courtCostBandLabel(costPerMatch: number): string {
  const cost = Math.max(0, costPerMatch);
  if (cost <= 300) return "≤ $300/partido";
  if (cost <= 600) return "$301–600/partido";
  return "$601+/partido";
}

export function portfolioDiscountRate(activeTournaments: number): number {
  const n = Math.max(1, Math.floor(activeTournaments));
  if (n <= 2) return 0;
  if (n <= 4) return 0.08;
  if (n <= 7) return 0.12;
  return 0.15;
}

export function portfolioBandLabel(activeTournaments: number): string {
  const n = Math.max(1, Math.floor(activeTournaments));
  if (n <= 2) return "1–2 torneos activos";
  if (n <= 4) return "3–4 torneos activos";
  if (n <= 7) return "5–7 torneos activos";
  return "8–10 torneos activos";
}

export function tierForMatchesPerMonth(matchesPerMonth: number): {
  tier: CotizadorTier;
  basePrice: number;
} {
  const m = Math.max(0, matchesPerMonth);
  if (m <= 20) return { tier: "S", basePrice: 900 };
  if (m <= 40) return { tier: "M", basePrice: 1400 };
  if (m <= 70) return { tier: "L", basePrice: 2000 };
  return { tier: "XL", basePrice: 2000 + (m - 70) * 20 };
}

export function calculateCotizacion(input: CotizadorInput): CotizadorResult | null {
  const teams = Math.max(0, Math.floor(input.teamCount));
  const months = Math.max(1, Math.floor(input.durationMonths));
  if (teams < 2) return null;

  const reg = regularMatches(teams, input.rounds);
  const po = playoffMatches(input.playoffBracket, input.thirdPlaceMatch);
  const totalMatches = reg + po;
  const matchesPerMonth = totalMatches / months;

  const { tier, basePrice } = tierForMatchesPerMonth(matchesPerMonth);
  const courtMult = courtCostMultiplier(input.courtCostPerMatch);
  const priceAfterCourtBand = basePrice * courtMult;
  const discountRate = portfolioDiscountRate(input.activeTournaments);
  const monthlyPrice = priceAfterCourtBand * (1 - discountRate);
  const seasonPrice = monthlyPrice * months;
  const pricePerTeamSeason = seasonPrice / teams;

  return {
    monthlyPrice,
    seasonPrice,
    pricePerTeamSeason,
    internal: {
      regularMatches: reg,
      playoffMatches: po,
      totalMatches,
      matchesPerMonth,
      tier,
      tierBasePrice: basePrice,
      courtMultiplier: courtMult,
      courtBandLabel: courtCostBandLabel(input.courtCostPerMatch),
      portfolioDiscountRate: discountRate,
      portfolioBandLabel: portfolioBandLabel(input.activeTournaments),
      priceBeforeCourtBand: basePrice,
      priceAfterCourtBand,
      portfolioDiscountAmount: priceAfterCourtBand - monthlyPrice,
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

/** @deprecated Migration 028 pricing defaults — cotizador v2 uses fixed tiers. */
export type CotizadorParams = {
  basePricePerTeam: number;
  durationMultiplierHasta3: number;
  durationMultiplier4To6: number;
  durationMultiplier7To12: number;
  volumeMultiplier1To2: number;
  volumeMultiplier3To5: number;
  volumeMultiplier6Plus: number;
};

/** @deprecated */
export const DEFAULT_COTIZADOR_PARAMS: CotizadorParams = {
  basePricePerTeam: 200,
  durationMultiplierHasta3: 1.0,
  durationMultiplier4To6: 1.6,
  durationMultiplier7To12: 2.6,
  volumeMultiplier1To2: 1.0,
  volumeMultiplier3To5: 0.9,
  volumeMultiplier6Plus: 0.8,
};
