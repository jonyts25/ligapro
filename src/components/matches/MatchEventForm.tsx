"use client";

import { useActionState, useMemo, useState } from "react";
import { recordMatchEventAction } from "@/lib/matches/actions";
import {
  MATCH_EVENT_TYPE_OPTIONS,
  initialCaptureActionState,
  type MatchRosterPlayer,
} from "@/lib/matches/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type MatchEventFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeName: string;
  awayName: string;
  roster: MatchRosterPlayer[];
  canCapture: boolean;
  matchClosed: boolean;
};

export function MatchEventForm({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  homeSeasonTeamId,
  awaySeasonTeamId,
  homeName,
  awayName,
  roster,
  canCapture,
  matchClosed,
}: MatchEventFormProps) {
  const [state, action, pending] = useActionState(
    recordMatchEventAction,
    initialCaptureActionState
  );
  const [teamId, setTeamId] = useState(homeSeasonTeamId);

  const players = useMemo(
    () =>
      roster.filter(
        (p) =>
          p.seasonTeamId === teamId && p.registrationStatus !== "inactive"
      ),
    [roster, teamId]
  );

  if (!canCapture) return null;
  if (matchClosed) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          El partido está cerrado; no se registran más eventos.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold">Registrar evento</h2>
      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
        >
          {state.message}
        </p>
      )}
      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="matchId" value={matchId} />

        <div className="space-y-1.5">
          <label htmlFor="eventType" className="text-sm font-medium">
            Tipo
          </label>
          <select
            id="eventType"
            name="eventType"
            required
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          >
            {MATCH_EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="teamSelect" className="text-sm font-medium">
            Equipo
          </label>
          <select
            id="teamSelect"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          >
            <option value={homeSeasonTeamId}>{homeName}</option>
            <option value={awaySeasonTeamId}>{awayName}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="seasonTeamPlayerId" className="text-sm font-medium">
            Jugador
          </label>
          <select
            id="seasonTeamPlayerId"
            name="seasonTeamPlayerId"
            required
            disabled={pending || players.length === 0}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          >
            <option value="">Seleccionar…</option>
            {players.map((p) => (
              <option key={p.seasonTeamPlayerId} value={p.seasonTeamPlayerId}>
                {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}
                {p.playerName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="minute" className="text-sm font-medium">
            Minuto (0–130)
          </label>
          <input
            id="minute"
            name="minute"
            type="number"
            min={0}
            max={130}
            required
            defaultValue={1}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium">
            Notas (opcional)
          </label>
          <input
            id="notes"
            name="notes"
            maxLength={200}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          />
        </div>

        <SubmitButton pending={pending} disabled={players.length === 0}>
          Registrar evento
        </SubmitButton>
      </form>
    </Card>
  );
}
