export type DurationBand = "corta" | "larga";

export type CotizadorParams = {
  basePricePerTeam: number;
  durationMultiplierShort: number;
  durationMultiplierLong: number;
  volumeMultiplier1To2: number;
  volumeMultiplier3To5: number;
  volumeMultiplier6Plus: number;
};

export type CotizadorInputs = {
  teamCount: number;
  durationBand: DurationBand;
  tournamentCount: number;
};

export const DEFAULT_COTIZADOR_PARAMS: CotizadorParams = {
  basePricePerTeam: 200,
  durationMultiplierShort: 1.0,
  durationMultiplierLong: 1.6,
  volumeMultiplier1To2: 1.0,
  volumeMultiplier3To5: 0.9,
  volumeMultiplier6Plus: 0.8,
};

export const DEFAULT_COTIZADOR_INPUTS: CotizadorInputs = {
  teamCount: 8,
  durationBand: "corta",
  tournamentCount: 1,
};

export function durationMultiplier(
  band: DurationBand,
  params: CotizadorParams
): number {
  return band === "corta"
    ? params.durationMultiplierShort
    : params.durationMultiplierLong;
}

export function volumeMultiplier(
  tournamentCount: number,
  params: CotizadorParams
): number {
  if (tournamentCount >= 6) return params.volumeMultiplier6Plus;
  if (tournamentCount >= 3) return params.volumeMultiplier3To5;
  return params.volumeMultiplier1To2;
}

export function volumeBandLabel(tournamentCount: number): string {
  if (tournamentCount >= 6) return "6+ torneos";
  if (tournamentCount >= 3) return "3–5 torneos";
  return "1–2 torneos";
}

export function durationBandLabel(band: DurationBand): string {
  return band === "corta" ? "≤ 3 meses" : "> 3 y ≤ 6 meses";
}

export type CotizadorResult = {
  pricePerTournament: number;
  totalPrice: number;
  durationMultiplier: number;
  volumeMultiplier: number;
  volumeBand: string;
};

export function calculateCotizacion(
  inputs: CotizadorInputs,
  params: CotizadorParams
): CotizadorResult | null {
  const teamCount = Math.max(0, Math.floor(inputs.teamCount));
  const tournamentCount = Math.max(0, Math.floor(inputs.tournamentCount));

  if (teamCount <= 0 || tournamentCount <= 0) {
    return null;
  }

  const durMult = durationMultiplier(inputs.durationBand, params);
  const volMult = volumeMultiplier(tournamentCount, params);
  const pricePerTournament =
    params.basePricePerTeam * teamCount * durMult * volMult;

  return {
    pricePerTournament,
    totalPrice: pricePerTournament * tournamentCount,
    durationMultiplier: durMult,
    volumeMultiplier: volMult,
    volumeBand: volumeBandLabel(tournamentCount),
  };
}

export function formatCotizadorMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}
