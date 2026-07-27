"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import {
  advanceKnockoutRoundAction,
  configureKnockoutRoundAction,
  createKnockoutBracketAction,
  setKnockoutPenaltyWinnerAction,
} from "@/lib/knockout/actions";
import type { KnockoutBracketData } from "@/lib/knockout/types";
import { initialKnockoutActionState } from "@/lib/knockout/types";
import {
  getRoundAdvanceStatus,
  isTieTied,
  nextPowerOfTwo,
  tieHasStartedPlay,
} from "@/lib/knockout/utils";
import { KnockoutBracketView } from "@/components/knockout/KnockoutBracketView";

type KnockoutBracketAdminPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  data: KnockoutBracketData;
  eligibleTeamCount: number;
  formatType: string;
};

function ActionMessage({ message, ok }: { message: string | null; ok: boolean }) {
  if (!message) return null;
  return (
    <p
      className={`rounded-xl border px-3 py-2 text-sm ${
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
      role={ok ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

export function KnockoutBracketAdminPanel({
  organizationId,
  competitionId,
  seasonId,
  data,
  eligibleTeamCount,
  formatType,
}: KnockoutBracketAdminPanelProps) {
  const [createState, createAction, createPending] = useActionState(
    createKnockoutBracketAction,
    initialKnockoutActionState
  );
  const [configState, configAction, configPending] = useActionState(
    configureKnockoutRoundAction,
    initialKnockoutActionState
  );
  const [penaltyState, penaltyAction, penaltyPending] = useActionState(
    setKnockoutPenaltyWinnerAction,
    initialKnockoutActionState
  );
  const [advanceState, advanceAction, advancePending] = useActionState(
    advanceKnockoutRoundAction,
    initialKnockoutActionState
  );

  const hidden = (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
    </>
  );

  const bracketSize = nextPowerOfTwo(eligibleTeamCount);
  const numByes = Math.max(0, bracketSize - eligibleTeamCount);
  const maxRound =
    data.rounds.length > 0
      ? Math.max(...data.rounds.map((r) => r.roundNumber))
      : 0;
  const latestRound = data.rounds.find((r) => r.roundNumber === maxRound);

  return (
    <div className="space-y-6">
      {!data.rounds.length && formatType === "knockout" && (
        <Card className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Generar bracket
          </h2>
          <p className="text-sm text-text-secondary">
            {eligibleTeamCount >= 2 ? (
              <>
                {eligibleTeamCount} equipos elegibles → bracket de{" "}
                {bracketSize} plazas ({numByes} bye
                {numByes === 1 ? "" : "s"}).
              </>
            ) : (
              <>Se necesitan al menos 2 equipos confirmados o inscritos.</>
            )}
          </p>
          <form action={createAction} className="space-y-3">
            {hidden}
            <SubmitButton
              pending={createPending}
              disabled={eligibleTeamCount < 2}
            >
              Generar bracket (sorteo aleatorio)
            </SubmitButton>
          </form>
          <ActionMessage message={createState.message} ok={createState.ok} />
        </Card>
      )}

      {latestRound && (
        <Card className="space-y-4 p-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Configuración — {latestRound.roundLabel}
          </h2>
          <p className="text-sm text-text-secondary">
            Ida/vuelta solo se puede cambiar mientras todos los partidos de la
            ronda sigan en estado programado.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={configAction}>
              {hidden}
              <input type="hidden" name="roundId" value={latestRound.id} />
              <input type="hidden" name="isTwoLegs" value="0" />
              <SubmitButton
                pending={configPending}
                disabled={latestRound.ties.some((t) =>
                  tieHasStartedPlay(t)
                )}
              >
                Partido único
              </SubmitButton>
            </form>
            <form action={configAction}>
              {hidden}
              <input type="hidden" name="roundId" value={latestRound.id} />
              <input type="hidden" name="isTwoLegs" value="1" />
              <SubmitButton
                pending={configPending}
                disabled={latestRound.ties.some((t) =>
                  tieHasStartedPlay(t)
                )}
              >
                Ida y vuelta
              </SubmitButton>
            </form>
          </div>
          <ActionMessage message={configState.message} ok={configState.ok} />

          {latestRound.ties.map((tie) => {
            if (
              !tie.awaySeasonTeamId ||
              !isTieTied(tie, latestRound.isTwoLegs)
            ) {
              return null;
            }
            return (
              <form
                key={tie.id}
                action={penaltyAction}
                className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3"
              >
                {hidden}
                <input type="hidden" name="roundId" value={latestRound.id} />
                <input
                  type="hidden"
                  name="bracketSlot"
                  value={tie.bracketSlot}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Llave {tie.bracketSlot} empatada</p>
                  <select
                    name="winnerSeasonTeamId"
                    required
                    className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Ganador por penales
                    </option>
                    <option value={tie.homeSeasonTeamId}>
                      {tie.homeTeamName}
                    </option>
                    <option value={tie.awaySeasonTeamId}>
                      {tie.awayTeamName}
                    </option>
                  </select>
                </div>
                <SubmitButton pending={penaltyPending}>
                  Registrar penales
                </SubmitButton>
              </form>
            );
          })}
          <ActionMessage message={penaltyState.message} ok={penaltyState.ok} />

          {(() => {
            const status = getRoundAdvanceStatus(latestRound, maxRound);
            if (status.isFinalRound && data.championTeamName) {
              return null;
            }
            return (
              <div className="space-y-2 border-t border-border pt-4">
                {status.canAdvance ? (
                  <form action={advanceAction}>
                    {hidden}
                    <input
                      type="hidden"
                      name="roundNumber"
                      value={latestRound.roundNumber}
                    />
                    <SubmitButton pending={advancePending}>
                      Avanzar a la siguiente ronda
                    </SubmitButton>
                  </form>
                ) : status.unresolvedSlots.length > 0 ? (
                  <p className="text-sm text-text-secondary">
                    Faltan resolver las llaves:{" "}
                    {status.unresolvedSlots.join(", ")}. La ronda{" "}
                    {latestRound.roundNumber + 1} se generará cuando termine la
                    ronda {latestRound.roundNumber}.
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    Ronda final completada.
                  </p>
                )}
                <ActionMessage
                  message={advanceState.message}
                  ok={advanceState.ok}
                />
              </div>
            );
          })()}
        </Card>
      )}

      <KnockoutBracketView
        data={data}
        organizationId={organizationId}
        competitionId={competitionId}
        seasonId={seasonId}
        showMatchLinks
      />
    </div>
  );
}
