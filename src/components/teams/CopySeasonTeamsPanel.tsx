"use client";

import { useActionState, useMemo, useState } from "react";
import { copySeasonTeamsAction } from "@/lib/teams/actions";
import {
  initialTeamsActionState,
  seasonTeamStatusLabel,
} from "@/lib/teams/types";
import type {
  CopyableSeasonTeam,
  PriorSeasonOption,
} from "@/lib/teams/queries";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

type CopySeasonTeamsPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  priorSeasons: PriorSeasonOption[];
  teamsBySeason: Record<string, CopyableSeasonTeam[]>;
};

export function CopySeasonTeamsPanel({
  organizationId,
  competitionId,
  seasonId,
  priorSeasons,
  teamsBySeason,
}: CopySeasonTeamsPanelProps) {
  const [state, action, pending] = useActionState(
    copySeasonTeamsAction,
    initialTeamsActionState
  );
  const [fromSeasonId, setFromSeasonId] = useState(priorSeasons[0]?.seasonId ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const teams = teamsBySeason[fromSeasonId] ?? [];

  const allSelected = useMemo(
    () => teams.length > 0 && teams.every((t) => selected.has(t.teamId)),
    [teams, selected]
  );

  function toggleTeam(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(teams.map((t) => t.teamId)));
    }
  }

  if (priorSeasons.length === 0) return null;

  return (
    <Card className="space-y-4 p-4">
      <SectionHeader
        title="Copiar equipos de temporada anterior"
        description="Trae equipos seleccionados de otra temporada del mismo torneo."
      />

      {state.message && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />

        <div className="space-y-1.5">
          <label htmlFor="fromSeasonId" className="text-sm font-medium">
            Temporada origen
          </label>
          <select
            id="fromSeasonId"
            name="fromSeasonId"
            value={fromSeasonId}
            onChange={(event) => {
              setFromSeasonId(event.target.value);
              setSelected(new Set());
            }}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {priorSeasons.map((season) => (
              <option key={season.seasonId} value={season.seasonId}>
                {season.label}
              </option>
            ))}
          </select>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-muted">
            No hay equipos inscritos en esa temporada.
          </p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-medium text-brand hover:underline"
            >
              {allSelected ? "Quitar todos" : "Seleccionar todos"}
            </button>
            <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              {teams.map((team) => (
                <li key={team.teamId}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="teamIds"
                      value={team.teamId}
                      checked={selected.has(team.teamId)}
                      onChange={() => toggleTeam(team.teamId)}
                      disabled={pending}
                    />
                    <span>
                      {team.teamName}
                      <span className="ml-2 text-xs text-muted">
                        ({seasonTeamStatusLabel(team.registrationStatus)})
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="copyRoster" value="1" disabled={pending} />
          También copiar plantel (sin capitanes)
        </label>

        <SubmitButton
          pending={pending}
          className="w-auto px-4"
          disabled={selected.size === 0}
        >
          Copiar seleccionados
        </SubmitButton>
      </form>
    </Card>
  );
}
