"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { recordMatchEventAction } from "@/lib/matches/actions";
import { captureErrorAlertClass } from "@/lib/matches/capture-errors";
import {
  initialCaptureActionState,
  type MatchEventType,
  type MatchRosterPlayer,
} from "@/lib/matches/types";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
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
  matchStartsAt?: string | null;
};

function suggestMatchMinute(startsAt: string | null | undefined): number {
  if (!startsAt) return 1;
  const startMs = new Date(startsAt).getTime();
  if (Number.isNaN(startMs)) return 1;
  const elapsed = Math.floor((Date.now() - startMs) / 60_000);
  if (elapsed < 1) return 1;
  return Math.min(130, elapsed);
}

const QUICK_ACTIONS: { type: MatchEventType; label: string; className: string }[] =
  [
    { type: "goal", label: "Gol", className: "bg-success/15 text-success border-success/30" },
    {
      type: "own_goal",
      label: "Autogol",
      className: "bg-warning/15 text-warning border-warning/30",
    },
    {
      type: "yellow_card",
      label: "Amarilla",
      className: "bg-yellow-400/20 text-yellow-800 border-yellow-500/40 dark:text-yellow-200",
    },
    { type: "red_card", label: "Roja", className: "bg-danger/15 text-danger border-danger/30" },
    { type: "injury", label: "Lesión", className: "bg-muted/20 text-text-secondary border-border" },
  ];

const SUBSTITUTION_ACTIONS: { type: MatchEventType; label: string }[] = [
  { type: "substitution_in", label: "Entra" },
  { type: "substitution_out", label: "Sale" },
];

function PlayerGrid({
  teamName,
  seasonTeamId,
  players,
  selectedId,
  onSelect,
  disabled,
}: {
  teamName: string;
  seasonTeamId: string;
  players: MatchRosterPlayer[];
  selectedId: string | null;
  onSelect: (player: MatchRosterPlayer) => void;
  disabled: boolean;
}) {
  const teamPlayers = useMemo(
    () =>
      players.filter(
        (p) =>
          p.seasonTeamId === seasonTeamId && p.registrationStatus !== "inactive"
      ),
    [players, seasonTeamId]
  );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{teamName}</h3>
      {teamPlayers.length === 0 ? (
        <p className="text-sm text-muted">Sin jugadores activos.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {teamPlayers.map((player) => {
            const selected = selectedId === player.seasonTeamPlayerId;
            return (
              <li key={player.seasonTeamPlayerId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(player)}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-center transition",
                    selected
                      ? "border-brand bg-brand/10 ring-2 ring-brand/40"
                      : "border-border bg-surface hover:border-brand/40"
                  )}
                >
                  <PlayerAvatar
                    photoUrl={player.photoUrl ?? null}
                    name={player.playerName}
                    size="sm"
                  />
                  {player.jerseyNumber != null && (
                    <span className="text-xs font-bold text-muted">
                      #{player.jerseyNumber}
                    </span>
                  )}
                  <span className="line-clamp-2 text-xs font-medium leading-tight">
                    {player.playerName}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

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
  matchStartsAt,
}: MatchEventFormProps) {
  const [state, action, pending] = useActionState(
    recordMatchEventAction,
    initialCaptureActionState
  );
  const [selected, setSelected] = useState<MatchRosterPlayer | null>(null);
  const [minute, setMinute] = useState(() => suggestMatchMinute(matchStartsAt));
  const [showSubstitution, setShowSubstitution] = useState(false);

  useEffect(() => {
    setMinute(suggestMatchMinute(matchStartsAt));
  }, [matchStartsAt]);

  useEffect(() => {
    if (state.ok) {
      setSelected(null);
      setShowSubstitution(false);
    }
  }, [state.ok]);

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

  const hasPlayers = roster.some((p) => p.registrationStatus !== "inactive");

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Captura rápida</h2>
        <p className="text-sm text-muted">
          Toca un jugador y el evento. Un tap por registro.
        </p>
      </div>

      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : captureErrorAlertClass(state.errorKind ?? "generic")
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}

      <PlayerGrid
        teamName={homeName}
        seasonTeamId={homeSeasonTeamId}
        players={roster}
        selectedId={selected?.seasonTeamPlayerId ?? null}
        onSelect={(player) => {
          setSelected(player);
          setShowSubstitution(false);
        }}
        disabled={pending}
      />
      <PlayerGrid
        teamName={awayName}
        seasonTeamId={awaySeasonTeamId}
        players={roster}
        selectedId={selected?.seasonTeamPlayerId ?? null}
        onSelect={(player) => {
          setSelected(player);
          setShowSubstitution(false);
        }}
        disabled={pending}
      />

      <form action={action} className="space-y-4 border-t border-border pt-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="matchId" value={matchId} />
        <input
          type="hidden"
          name="seasonTeamPlayerId"
          value={selected?.seasonTeamPlayerId ?? ""}
        />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Minuto</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending || minute <= 0}
              onClick={() => setMinute((m) => Math.max(0, m - 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-lg font-semibold"
              aria-label="Restar un minuto"
            >
              −
            </button>
            <input
              id="minute"
              name="minute"
              type="number"
              min={0}
              max={130}
              value={minute}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isNaN(next)) {
                  setMinute(Math.min(130, Math.max(0, next)));
                }
              }}
              disabled={pending}
              className="h-11 w-16 rounded-xl border border-border bg-surface px-2 text-center text-sm font-semibold"
            />
            <button
              type="button"
              disabled={pending || minute >= 130}
              onClick={() => setMinute((m) => Math.min(130, m + 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-lg font-semibold"
              aria-label="Sumar un minuto"
            >
              +
            </button>
          </div>
        </div>

        {selected ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-muted">Jugador: </span>
              <span className="font-medium">{selected.playerName}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {QUICK_ACTIONS.map((actionDef) => (
                <button
                  key={actionDef.type}
                  type="submit"
                  name="eventType"
                  value={actionDef.type}
                  disabled={pending}
                  className={cn(
                    "min-h-12 rounded-xl border px-3 text-sm font-semibold",
                    actionDef.className
                  )}
                >
                  {actionDef.label}
                </button>
              ))}
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowSubstitution((v) => !v)}
                className="min-h-12 rounded-xl border border-border bg-surface px-3 text-sm font-semibold"
              >
                Cambio
              </button>
            </div>
            {showSubstitution && (
              <div className="grid grid-cols-2 gap-2">
                {SUBSTITUTION_ACTIONS.map((sub) => (
                  <button
                    key={sub.type}
                    type="submit"
                    name="eventType"
                    value={sub.type}
                    disabled={pending}
                    className="min-h-12 rounded-xl border border-brand/40 bg-brand/10 px-3 text-sm font-semibold text-brand"
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {hasPlayers
              ? "Selecciona un jugador arriba para registrar un evento."
              : "No hay jugadores disponibles en el plantel."}
          </p>
        )}
      </form>
    </Card>
  );
}
