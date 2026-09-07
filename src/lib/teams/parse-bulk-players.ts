export type BulkPlayerPreview = {
  fullName: string;
  explicitJersey: number | null;
  finalJersey: number;
  autoAssigned: boolean;
};

function parseRawBulkPlayerLines(bulkList: string): Array<{
  fullName: string;
  explicitJersey: number | null;
}> {
  return bulkList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,;\t]/).map((part) => part.trim());
      const fullName = parts[0] ?? "";
      const jerseyRaw = parts[1];
      const explicitJersey =
        jerseyRaw && /^\d+$/.test(jerseyRaw)
          ? Number.parseInt(jerseyRaw, 10)
          : null;
      return { fullName, explicitJersey };
    })
    .filter((entry) => entry.fullName.length >= 2);
}

export function parseBulkPlayerLines(bulkList: string): BulkPlayerPreview[] {
  const parsed = parseRawBulkPlayerLines(bulkList);
  const usedJerseys = new Set<number>();
  const result: BulkPlayerPreview[] = [];

  for (const { fullName, explicitJersey } of parsed) {
    let finalJersey: number;
    let autoAssigned: boolean;

    if (explicitJersey != null && explicitJersey > 0) {
      finalJersey = explicitJersey;
      autoAssigned = false;
    } else {
      let next = 1;
      while (usedJerseys.has(next)) {
        next += 1;
      }
      finalJersey = next;
      autoAssigned = true;
    }

    usedJerseys.add(finalJersey);
    result.push({ fullName, explicitJersey, finalJersey, autoAssigned });
  }

  return result;
}

export function getDuplicateJerseyWarnings(
  players: BulkPlayerPreview[]
): string[] {
  const byJersey = new Map<number, string[]>();

  for (const player of players) {
    const names = byJersey.get(player.finalJersey) ?? [];
    names.push(player.fullName);
    byJersey.set(player.finalJersey, names);
  }

  const warnings: string[] = [];
  for (const [jersey, names] of byJersey) {
    if (names.length > 1) {
      warnings.push(
        `⚠️ ${names.join(" y ")} tienen el mismo número (${jersey}) — cámbialo antes de continuar`
      );
    }
  }

  return warnings;
}

export function hasDuplicateJerseyNumbers(players: BulkPlayerPreview[]): boolean {
  return getDuplicateJerseyWarnings(players).length > 0;
}

export function bulkPlayerEntriesForRpc(
  bulkList: string
): Array<{ full_name: string; jersey_number: number }> {
  return parseBulkPlayerLines(bulkList).map((player) => ({
    full_name: player.fullName,
    jersey_number: player.finalJersey,
  }));
}

export function parseBulkTeamNames(bulkList: string): string[] {
  return bulkList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
