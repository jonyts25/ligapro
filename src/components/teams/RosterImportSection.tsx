"use client";

import { useEffect, useState, useTransition } from "react";
import { loadTeamRosterImportOptionsAction } from "@/lib/teams/roster-import-actions";
import {
  buildRosterImportOverCapacityWarning,
  formatRosterImportSourceLabel,
  type RosterImportSource,
} from "@/lib/teams/roster-import";

type RosterImportSectionProps = {
  organizationId: string;
  seasonId: string;
  teamId: string;
  disabled?: boolean;
  defaultImportRoster?: boolean;
  defaultSourceSeasonTeamId?: string;
};

export function RosterImportSection({
  organizationId,
  seasonId,
  teamId,
  disabled = false,
  defaultImportRoster = false,
  defaultSourceSeasonTeamId = "",
}: RosterImportSectionProps) {
  const [sources, setSources] = useState<RosterImportSource[]>([]);
  const [maxRosterSize, setMaxRosterSize] = useState<number | null>(null);
  const [importRoster, setImportRoster] = useState(defaultImportRoster);
  const [sourceSeasonTeamId, setSourceSeasonTeamId] = useState(
    defaultSourceSeasonTeamId
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!teamId) {
      setSources([]);
      setMaxRosterSize(null);
      setImportRoster(false);
      setSourceSeasonTeamId("");
      setLoadError(null);
      return;
    }

    startTransition(async () => {
      try {
        const options = await loadTeamRosterImportOptionsAction(
          organizationId,
          seasonId,
          teamId
        );
        setSources(options.sources);
        setMaxRosterSize(options.maxRosterSize);
        setLoadError(null);

        const preferredSource =
          options.sources.find(
            (source) => source.seasonTeamId === defaultSourceSeasonTeamId
          ) ?? options.sources[0];

        if (preferredSource) {
          setSourceSeasonTeamId(preferredSource.seasonTeamId);
          setImportRoster(defaultImportRoster || options.sources.length === 1);
        } else {
          setSourceSeasonTeamId("");
          setImportRoster(false);
        }
      } catch {
        setSources([]);
        setMaxRosterSize(null);
        setSourceSeasonTeamId("");
        setImportRoster(false);
        setLoadError("No pudimos cargar planteles anteriores de este equipo.");
      }
    });
  }, [
    organizationId,
    seasonId,
    teamId,
    defaultImportRoster,
    defaultSourceSeasonTeamId,
  ]);

  const selectedSource =
    sources.find((source) => source.seasonTeamId === sourceSeasonTeamId) ??
    null;
  const overCapacityWarning = selectedSource
    ? buildRosterImportOverCapacityWarning(
        selectedSource.activePlayers.length,
        maxRosterSize
      )
    : null;

  if (!teamId) return null;
  if (isPending && sources.length === 0) {
    return (
      <p className="text-sm text-muted">Buscando planteles anteriores…</p>
    );
  }
  if (loadError) {
    return (
      <p className="text-sm text-danger" role="alert">
        {loadError}
      </p>
    );
  }
  if (sources.length === 0) return null;

  const selectedLabel = selectedSource
    ? formatRosterImportSourceLabel(selectedSource)
    : "torneo anterior";

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-4">
      <input
        type="hidden"
        name="importRoster"
        value={importRoster ? "1" : "0"}
      />
      <input
        type="hidden"
        name="sourceSeasonTeamId"
        value={importRoster ? sourceSeasonTeamId : ""}
      />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={importRoster}
          onChange={(event) => setImportRoster(event.target.checked)}
          disabled={disabled || isPending}
          className="mt-0.5"
        />
        <span>
          Importar plantel de{" "}
          <span className="font-medium">{selectedLabel}</span>
        </span>
      </label>

      {importRoster && sources.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="rosterImportSource" className="block text-sm font-medium">
            Importar desde
          </label>
          <select
            id="rosterImportSource"
            value={sourceSeasonTeamId}
            onChange={(event) => setSourceSeasonTeamId(event.target.value)}
            disabled={disabled || isPending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {sources.map((source) => (
              <option key={source.seasonTeamId} value={source.seasonTeamId}>
                {formatRosterImportSourceLabel(source)} ({source.activePlayers.length}{" "}
                jugadores)
              </option>
            ))}
          </select>
        </div>
      )}

      {importRoster && selectedSource && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">
            Vista previa ({selectedSource.activePlayers.length} jugadores activos)
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {selectedSource.activePlayers.map((player) => (
              <li
                key={player.playerId}
                className="flex items-center justify-between gap-3"
              >
                <span>{player.fullName}</span>
                <span className="text-muted">
                  {player.jerseyNumber != null ? `#${player.jerseyNumber}` : "Sin dorsal"}
                </span>
              </li>
            ))}
          </ul>
          {overCapacityWarning && (
            <p
              className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
              role="status"
            >
              {overCapacityWarning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
