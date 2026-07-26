import {
  isSeasonRosterSeatConflict,
  seasonRosterSeatConflictMessage,
} from "@/lib/teams/roster-errors";

export function humanizeCaptainRosterAddError(message: string): string {
  const lower = message.toLowerCase();

  if (isSeasonRosterSeatConflict({ message })) {
    return seasonRosterSeatConflictMessage();
  }

  if (lower.includes("maximum size")) {
    const match = message.match(/maximum size \((\d+) players\)/i);
    const max = match?.[1];
    return max
      ? `El plantel ya alcanzó el tope de ${max} jugadores permitidos por la liga.`
      : "El plantel ya alcanzó el tope de jugadores permitido por la liga.";
  }

  if (lower.includes("locked for this team")) {
    return "Tu liga bloqueó las altas de jugadores en este plantel. Contacta al administrador.";
  }

  if (lower.includes("not authorized")) {
    return "No tienes permiso para agregar jugadores a este plantel.";
  }

  return "No pudimos agregar al jugador. Revisa los datos e inténtalo de nuevo.";
}
