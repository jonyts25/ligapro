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

export function humanizeCaptainJerseyUpdateError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("jersey edits by the captain are locked")) {
    return "El plantel está bloqueado. Contacta al administrador para cualquier cambio.";
  }

  if (lower.includes("not authorized")) {
    return "No tienes permiso para editar este plantel.";
  }

  if (lower.includes("only active roster players")) {
    return "Solo puedes editar dorsales de jugadores activos.";
  }

  if (lower.includes("positive integer")) {
    return "El dorsal debe ser un número entero positivo.";
  }

  return "No pudimos guardar el dorsal. Inténtalo de nuevo.";
}
