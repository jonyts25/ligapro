"use client";

import { useActionState, useMemo, useState } from "react";
import { validateMatchRosterAction } from "@/lib/matches/participation";
import { captureErrorAlertClass } from "@/lib/matches/capture-errors";
import {
  initialCaptureActionState,
  type MatchRosterPlayer,
} from "@/lib/matches/types";
import {
  participationStatusLabel,
  type MatchParticipantRow,
} from "@/lib/matches/participation-types";
import { formatRosterSuspensionAlert } from "@/lib/shared/match-roster-for-capture";
import { cn } from "@/lib/utils/cn";

type MatchRosterValidationFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
  homeName: string;
  awayName: string;
  roster: MatchRosterPlayer[];
  participants: MatchParticipantRow[];
  canCapture: boolean;
  matchClosed: boolean;
};

function TeamParticipationList({
  teamName,
  seasonTeamId,
  roster,
  participants,
  selectedIds,
  onToggle,
  disabled,
}: {
  teamName: string;
  seasonTeamId: string;
  roster: MatchRosterPlayer[];
  participants: MatchParticipantRow[];
  selectedIds: Set<string>;
  onToggle: (seasonTeamPlayerId: string) => void;
  disabled: boolean;
}) {
  const teamPlayers = useMemo(
    () => roster.filter((player) => player.seasonTeamId === seasonTeamId),
    [roster, seasonTeamId]
  );
  const statusByPlayerId = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participants) {
      map.set(participant.seasonTeamPlayerId, participant.status);
    }
    return map;
  }, [participants]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{teamName}</h3>
      <ul className="space-y-1">
        {teamPlayers.map((player) => {
          const status = statusByPlayerId.get(player.seasonTeamPlayerId);
          const jersey =
            player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—";
          const suspensionAlert = formatRosterSuspensionAlert(player);

          return (
            <li
              key={player.seasonTeamPlayerId}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-sm",
                player.isSuspended
                  ? "border-warning/50 bg-warning/10"
                  : "border-border"
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(player.seasonTeamPlayerId)}
                disabled={disabled}
                onChange={() => onToggle(player.seasonTeamPlayerId)}
              />
              <span className="min-w-0 flex-1 truncate">
                {jersey} {player.playerName}
              </span>
              {suspensionAlert ? (
                <span
                  className="shrink-0 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning"
                  role="status"
                >
                  {suspensionAlert}
                </span>
              ) : null}
              <span className="text-xs text-text-secondary">
                {status ? participationStatusLabel(status) : "Sin registro"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MatchRosterValidationForm({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  homeSeasonTeamId,
  awaySeasonTeamId,
  homeName,
  awayName,
  roster,
  participants,
  canCapture,
  matchClosed,
}: MatchRosterValidationFormProps) {
  const [state, formAction, pending] = useActionState(
    validateMatchRosterAction,
    initialCaptureActionState
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const participant of participants) {
      if (participant.status === "played") {
        initial.add(participant.seasonTeamPlayerId);
      }
    }
    return initial;
  });

  if (!canCapture) {
    return null;
  }

  const disabled = matchClosed || pending;

  function togglePlayer(seasonTeamPlayerId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(seasonTeamPlayerId)) {
        next.delete(seasonTeamPlayerId);
      } else {
        next.add(seasonTeamPlayerId);
      }
      return next;
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h2 className="text-base font-semibold">Validación de plantel</h2>
        <p className="text-sm text-text-secondary">
          Selecciona quién jugó. Los convocados no marcados quedarán como no
          presentados.
        </p>
      </div>

      <TeamParticipationList
        teamName={homeName}
        seasonTeamId={homeSeasonTeamId}
        roster={roster}
        participants={participants}
        selectedIds={selectedIds}
        onToggle={togglePlayer}
        disabled={disabled}
      />
      <TeamParticipationList
        teamName={awayName}
        seasonTeamId={awaySeasonTeamId}
        roster={roster}
        participants={participants}
        selectedIds={selectedIds}
        onToggle={togglePlayer}
        disabled={disabled}
      />

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="matchId" value={matchId} />
        <input
          type="hidden"
          name="seasonTeamPlayerIds"
          value={[...selectedIds].join(",")}
        />

        <button
          type="submit"
          disabled={disabled || selectedIds.size === 0}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Validando…" : "Validar plantel"}
        </button>
      </form>

      {state.message ? (
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
      ) : null}
    </section>
  );
}
