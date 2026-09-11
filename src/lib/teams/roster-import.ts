export type RosterImportPreviewPlayer = {
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
};

export type RosterImportSource = {
  seasonTeamId: string;
  seasonId: string;
  competitionId: string;
  competitionName: string;
  seasonName: string;
  seasonCreatedAt: string;
  seasonStartsOn: string | null;
  activePlayers: RosterImportPreviewPlayer[];
};

export type RosterImportInsertRow = {
  playerId: string;
  jerseyNumber: number | null;
  registrationStatus: "active";
};

export function formatRosterImportSourceLabel(source: {
  competitionName: string;
  seasonStartsOn: string | null;
  seasonCreatedAt: string;
}): string {
  const dateSource = source.seasonStartsOn ?? source.seasonCreatedAt.slice(0, 10);
  const formatted = new Date(`${dateSource}T12:00:00`).toLocaleDateString("es-MX", {
    month: "short",
    year: "numeric",
  });
  return `${source.competitionName} · ${formatted}`;
}

export function selectActivePlayersForImport(
  players: Array<{
    playerId: string;
    fullName: string;
    jerseyNumber: number | null;
    registrationStatus: string;
  }>
): RosterImportPreviewPlayer[] {
  return players
    .filter((player) => player.registrationStatus === "active")
    .map((player) => ({
      playerId: player.playerId,
      fullName: player.fullName,
      jerseyNumber: player.jerseyNumber,
    }));
}

export function buildRosterImportInsertRows(
  activePlayers: RosterImportPreviewPlayer[]
): RosterImportInsertRow[] {
  return activePlayers.map((player) => ({
    playerId: player.playerId,
    jerseyNumber: player.jerseyNumber,
    registrationStatus: "active" as const,
  }));
}

export function buildRosterImportOverCapacityWarning(
  importedActiveCount: number,
  maxRosterSize: number | null
): string | null {
  if (maxRosterSize == null || importedActiveCount <= maxRosterSize) {
    return null;
  }
  return `Se importaron ${importedActiveCount} jugadores activos, pero el máximo permitido es ${maxRosterSize}. Marca a los excedentes como inactivos antes de confirmar la inscripción.`;
}
