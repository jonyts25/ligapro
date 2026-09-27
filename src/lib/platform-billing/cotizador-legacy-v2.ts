/**
 * Modelo mensual por volumen de partidos (cotizador v2, 2026-08).
 * Conservado solo para comparaciones en reportes/tests — no usar en producción.
 */

export type LegacyV2Input = {
  teamCount: number;
  rounds: 1 | 2;
  playoffBracket: "none" | "top4" | "top8" | "top16";
  thirdPlaceMatch: boolean;
  durationMonths: number;
  courtCostPerMatch: number;
  activeTournaments: number;
};

function regularMatches(teamCount: number, rounds: 1 | 2): number {
  const teams = Math.max(0, Math.floor(teamCount));
  if (teams < 2) return 0;
  return ((teams * (teams - 1)) / 2) * rounds;
}

function playoffMatches(
  bracket: LegacyV2Input["playoffBracket"],
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

function tierBasePrice(matchesPerMonth: number): number {
  if (matchesPerMonth <= 20) return 900;
  if (matchesPerMonth <= 40) return 1400;
  if (matchesPerMonth <= 70) return 2000;
  return 2000 + (matchesPerMonth - 70) * 20;
}

function courtCostMultiplier(costPerMatch: number): number {
  const cost = Math.max(0, costPerMatch);
  if (cost <= 300) return 1.0;
  if (cost <= 600) return 1.15;
  return 1.3;
}

function portfolioDiscountRate(activeTournaments: number): number {
  const n = Math.max(1, Math.floor(activeTournaments));
  if (n <= 2) return 0;
  if (n <= 4) return 0.08;
  if (n <= 7) return 0.12;
  return 0.15;
}

export function calculateCotizacionLegacyV2(input: LegacyV2Input): {
  monthlyPrice: number;
  seasonPrice: number;
} | null {
  const teams = Math.max(0, Math.floor(input.teamCount));
  const months = Math.max(1, Math.floor(input.durationMonths));
  if (teams < 2) return null;

  const totalMatches =
    regularMatches(teams, input.rounds) +
    playoffMatches(input.playoffBracket, input.thirdPlaceMatch);
  const matchesPerMonth = totalMatches / months;
  const basePrice = tierBasePrice(matchesPerMonth);
  const priceAfterCourt = basePrice * courtCostMultiplier(input.courtCostPerMatch);
  const monthlyPrice = priceAfterCourt * (1 - portfolioDiscountRate(input.activeTournaments));

  return {
    monthlyPrice,
    seasonPrice: monthlyPrice * months,
  };
}
