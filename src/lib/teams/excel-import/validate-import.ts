import {
  getDuplicateJerseyWarnings,
  parseBulkPlayerLines,
} from "@/lib/teams/parse-bulk-players";
import { buildRosterImportOverCapacityWarning } from "@/lib/teams/roster-import";
import type {
  MappedImportRow,
  SkippedImportRow,
} from "@/lib/teams/excel-import/types";

export type ValidatedImportBatch = {
  rowsByTeam: Map<string, MappedImportRow[]>;
  skippedRows: SkippedImportRow[];
};

function normalizeKey(team: string, player: string): string {
  return `${team.trim().toLowerCase()}::${player.trim().toLowerCase()}`;
}

export function validateMappedImportRows(
  rows: MappedImportRow[]
): ValidatedImportBatch {
  const skippedRows: SkippedImportRow[] = [];
  const seen = new Set<string>();
  const rowsByTeam = new Map<string, MappedImportRow[]>();

  for (const row of rows) {
    if (!row.equipo.trim()) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        reason: "Falta nombre de equipo",
      });
      continue;
    }

    if (row.jugador.trim().length < 2) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        reason: "Falta nombre de jugador",
      });
      continue;
    }

    const duplicateKey = normalizeKey(row.equipo, row.jugador);
    if (seen.has(duplicateKey)) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        reason: "Duplicado en el archivo (mismo jugador y equipo)",
      });
      continue;
    }

    seen.add(duplicateKey);
    const teamName = row.equipo.trim();
    const teamRows = rowsByTeam.get(teamName) ?? [];
    teamRows.push({ ...row, equipo: teamName, jugador: row.jugador.trim() });
    rowsByTeam.set(teamName, teamRows);
  }

  return { rowsByTeam, skippedRows };
}

export function buildTeamJerseyWarnings(teamRows: MappedImportRow[]): string[] {
  const bulkList = teamRows
    .map((row) =>
      row.dorsal != null ? `${row.jugador},${row.dorsal}` : row.jugador
    )
    .join("\n");

  return getDuplicateJerseyWarnings(parseBulkPlayerLines(bulkList));
}

export function resolveTeamJerseyNumbers(
  teamRows: MappedImportRow[]
): Map<number, MappedImportRow> {
  const bulkList = teamRows
    .map((row) =>
      row.dorsal != null ? `${row.jugador},${row.dorsal}` : row.jugador
    )
    .join("\n");

  const parsed = parseBulkPlayerLines(bulkList);
  const byName = new Map(parsed.map((player) => [player.fullName, player]));
  const resolved = new Map<number, MappedImportRow>();

  for (const row of teamRows) {
    const jersey = byName.get(row.jugador)?.finalJersey;
    if (jersey != null) {
      resolved.set(row.rowNumber, { ...row, dorsal: jersey });
    }
  }

  return resolved;
}

export function buildOverCapacityWarnings(
  teamCounts: Array<{ teamName: string; activeCount: number }>,
  maxRosterSize: number | null
): string[] {
  const warnings: string[] = [];

  for (const team of teamCounts) {
    const warning = buildRosterImportOverCapacityWarning(
      team.activeCount,
      maxRosterSize
    );
    if (warning) {
      warnings.push(`${team.teamName}: ${warning}`);
    }
  }

  return warnings;
}
