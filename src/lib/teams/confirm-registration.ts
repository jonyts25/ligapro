export function buildConfirmTeamBlockedMessage(
  activeCount: number,
  maxRosterSize: number
): string {
  return `Este equipo tiene ${activeCount} jugadores activos, el máximo permitido es ${maxRosterSize} — marca a los jugadores excedentes como inactivos antes de confirmar.`;
}

export function canConfirmTeamRegistration(input: {
  registrationStatus: string;
  activePlayerCount: number;
  maxRosterSize: number | null;
}): { ok: true } | { ok: false; message: string } {
  if (input.registrationStatus !== "registered") {
    return {
      ok: false,
      message: "Solo se pueden confirmar equipos en estado pendiente.",
    };
  }

  if (
    input.maxRosterSize != null &&
    input.activePlayerCount > input.maxRosterSize
  ) {
    return {
      ok: false,
      message: buildConfirmTeamBlockedMessage(
        input.activePlayerCount,
        input.maxRosterSize
      ),
    };
  }

  return { ok: true };
}
