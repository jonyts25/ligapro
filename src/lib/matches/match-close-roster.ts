export const MATCH_CLOSE_ROSTER_RPC_ERROR =
  "Neither team has active players on the roster to close this match";

export const MATCH_CLOSE_ROSTER_USER_MESSAGE =
  "Ninguno de los equipos tiene jugadores activos en el plantel. Agrega al menos un jugador en local o visitante antes de cerrar el partido.";

const CLOSE_STATUSES = new Set(["finished", "walkover"]);

export function validateMatchCloseRoster(input: {
  homeActiveCount: number;
  awayActiveCount: number;
  targetStatus: string;
}): { ok: true } | { ok: false; message: string } {
  if (!CLOSE_STATUSES.has(input.targetStatus)) {
    return { ok: true };
  }

  if (input.homeActiveCount <= 0 && input.awayActiveCount <= 0) {
    return { ok: false, message: MATCH_CLOSE_ROSTER_RPC_ERROR };
  }

  return { ok: true };
}
