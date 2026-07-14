/**
 * Map Supabase/Postgres errors for roster season exclusivity to safe UI copy.
 * Never expose constraint names, SQLSTATE, or SQL text.
 */

const DEFAULT_SEAT_MESSAGE =
  "Este jugador ya pertenece a otro equipo en esta temporada. Márcalo como inactivo en el plantel anterior antes de agregarlo aquí.";

export function isSeasonRosterSeatConflict(error: {
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "23505") {
    return (
      message.includes("one_active_or_suspended_per_season") ||
      message.includes("(season_id, player_id)") ||
      message.includes("season_team_players_one_active")
    );
  }
  return (
    message.includes("already occupies another") ||
    message.includes("one_active_or_suspended_per_season")
  );
}

export function seasonRosterSeatConflictMessage(
  occupiedTeamName?: string | null
): string {
  const trimmed = occupiedTeamName?.trim();
  if (trimmed) {
    return `Este jugador ya está registrado con ${trimmed} en esta temporada. Márcalo como inactivo en ese plantel antes de agregarlo aquí.`;
  }
  return DEFAULT_SEAT_MESSAGE;
}
