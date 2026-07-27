export type DurationBand = "hasta_3" | "4_6" | "7_12";

export type CotizadorLine = {
  id: string;
  teamCount: number;
  durationBand: DurationBand;
};

export type CotizadorParams = {
  basePricePerTeam: number;
  durationMultiplierHasta3: number;
  durationMultiplier4To6: number;
  durationMultiplier7To12: number;
  volumeMultiplier1To2: number;
  volumeMultiplier3To5: number;
  volumeMultiplier6Plus: number;
};

export const DEFAULT_COTIZADOR_PARAMS: CotizadorParams = {
  basePricePerTeam: 200,
  durationMultiplierHasta3: 1.0,
  durationMultiplier4To6: 1.6,
  durationMultiplier7To12: 2.6,
  volumeMultiplier1To2: 1.0,
  volumeMultiplier3To5: 0.9,
  volumeMultiplier6Plus: 0.8,
};

export const DEFAULT_COTIZADOR_LINE: Omit<CotizadorLine, "id"> = {
  teamCount: 8,
  durationBand: "hasta_3",
};

export function createCotizadorLine(
  overrides: Partial<Omit<CotizadorLine, "id">> = {}
): CotizadorLine {
  return {
    id: crypto.randomUUID(),
    ...DEFAULT_COTIZADOR_LINE,
    ...overrides,
  };
}

export function durationMultiplier(
  band: DurationBand,
  params: CotizadorParams
): number {
  if (band === "hasta_3") return params.durationMultiplierHasta3;
  if (band === "4_6") return params.durationMultiplier4To6;
  return params.durationMultiplier7To12;
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
  if (band === "hasta_3") return "≤ 3 meses";
  if (band === "4_6") return "4–6 meses";
  return "7–12 meses";
}

export type CotizadorLineResult = {
  lineId: string;
  teamCount: number;
  durationBand: DurationBand;
  durationLabel: string;
  durationMultiplier: number;
  subtotal: number;
};

export type CotizadorQuoteResult = {
  lines: CotizadorLineResult[];
  tournamentCount: number;
  subtotalBeforeVolume: number;
  volumeMultiplier: number;
  volumeBand: string;
  volumeDiscountAmount: number;
  finalTotal: number;
};

export function calculateLineSubtotal(
  line: CotizadorLine,
  params: CotizadorParams
): CotizadorLineResult | null {
  const teamCount = Math.max(0, Math.floor(line.teamCount));
  if (teamCount <= 0) return null;

  const durMult = durationMultiplier(line.durationBand, params);
  return {
    lineId: line.id,
    teamCount,
    durationBand: line.durationBand,
    durationLabel: durationBandLabel(line.durationBand),
    durationMultiplier: durMult,
    subtotal: params.basePricePerTeam * teamCount * durMult,
  };
}

export function calculateCotizacion(
  lines: CotizadorLine[],
  params: CotizadorParams
): CotizadorQuoteResult | null {
  const lineResults = lines
    .map((line) => calculateLineSubtotal(line, params))
    .filter((line): line is CotizadorLineResult => line !== null);

  if (lineResults.length === 0) return null;

  const subtotalBeforeVolume = lineResults.reduce(
    (sum, line) => sum + line.subtotal,
    0
  );
  const tournamentCount = lineResults.length;
  const volMult = volumeMultiplier(tournamentCount, params);
  const finalTotal = subtotalBeforeVolume * volMult;
  const volumeDiscountAmount = subtotalBeforeVolume - finalTotal;

  return {
    lines: lineResults,
    tournamentCount,
    subtotalBeforeVolume,
    volumeMultiplier: volMult,
    volumeBand: volumeBandLabel(tournamentCount),
    volumeDiscountAmount,
    finalTotal,
  };
}

export function formatCotizadorMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

export function pricePerMonth(total: number, band: DurationBand): number {
  const months = band === "hasta_3" ? 3 : band === "4_6" ? 6 : 12;
  return total / months;
}
