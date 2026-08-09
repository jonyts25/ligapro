export type JornadaSummaryContent = {
  jugador_jornada: string;
  sorprendio: string;
  decepciono: string;
  resumen_general: string;
};

export type JornadaSummaryRecord = {
  id: string;
  seasonId: string;
  roundLabel: string;
  content: JornadaSummaryContent;
  isPublished: boolean;
  updatedAt: string;
};

export type JornadaSummaryActionState = {
  ok: boolean;
  message: string | null;
  needsConfirm?: boolean;
};

export const initialJornadaSummaryActionState: JornadaSummaryActionState = {
  ok: false,
  message: null,
};

export function jornadaRoundLabel(roundNumber: number): string {
  return `Jornada ${roundNumber}`;
}

export function emptyJornadaContent(): JornadaSummaryContent {
  return {
    jugador_jornada: "",
    sorprendio: "",
    decepciono: "",
    resumen_general: "",
  };
}

export function parseJornadaContent(raw: unknown): JornadaSummaryContent {
  const base = emptyJornadaContent();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  return {
    jugador_jornada: String(obj.jugador_jornada ?? ""),
    sorprendio: String(obj.sorprendio ?? ""),
    decepciono: String(obj.decepciono ?? ""),
    resumen_general: String(obj.resumen_general ?? ""),
  };
}
