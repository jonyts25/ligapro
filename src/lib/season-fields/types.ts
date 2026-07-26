export type SeasonFieldBlock = {
  id?: string;
  field_id: string;
  field_name: string;
  venue_name: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

export type ActiveFieldOption = {
  id: string;
  name: string;
  venueName: string;
  venueActive: boolean;
  fieldActive: boolean;
};

export type SeasonFieldBlocksActionState = {
  ok: boolean;
  message: string | null;
};

export const initialSeasonFieldBlocksActionState: SeasonFieldBlocksActionState =
  {
    ok: false,
    message: null,
  };

export function humanizeSeasonFieldBlocksError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("another season") || lower.includes("another tournament")) {
    return "Ese horario ya está reservado para otra temporada en la misma cancha. Elige otra franja o cancha.";
  }
  if (lower.includes("overlap")) {
    return "Hay bloqueos que se solapan en la misma cancha y día. Revisa los horarios.";
  }
  if (lower.includes("not authorized")) {
    return "No tienes permiso para editar los bloqueos de cancha.";
  }
  return "No pudimos guardar los bloqueos. Revisa los datos e inténtalo de nuevo.";
}
