"use client";

import { useActionState, useState } from "react";
import {
  adjustDisciplineSuspensionAction,
  createAdministrativeSuspensionAction,
  waiveDisciplineSuspensionAction,
} from "@/lib/discipline/actions";
import {
  SUSPENSION_TYPE_OPTIONS,
  initialDisciplineActionState,
  suspensionTypeLabel,
  type ActiveSuspensionRow,
  type RosterPlayerOption,
} from "@/lib/discipline/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type DisciplineAdminPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  activeSuspensions: ActiveSuspensionRow[];
  rosterPlayers: RosterPlayerOption[];
};

function ActionMessage({
  ok,
  message,
}: {
  ok: boolean;
  message: string | null;
}) {
  if (!message) return null;
  return (
    <p
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger"
      )}
      role={ok ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

function SuspensionAdminActions({
  organizationId,
  competitionId,
  seasonId,
  suspension,
}: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  suspension: ActiveSuspensionRow;
}) {
  const [waiveState, waiveAction, waivePending] = useActionState(
    waiveDisciplineSuspensionAction,
    initialDisciplineActionState
  );
  const [adjustState, adjustAction, adjustPending] = useActionState(
    adjustDisciplineSuspensionAction,
    initialDisciplineActionState
  );
  const [showWaive, setShowWaive] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [waiveReason, setWaiveReason] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [matchesRemaining, setMatchesRemaining] = useState(
    String(suspension.matchesRemaining)
  );

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-medium text-text-primary">
          {suspension.playerName}
        </p>
        <p className="text-sm text-text-secondary">
          {suspension.teamName} · {suspensionTypeLabel(suspension.suspensionType)}{" "}
          · {suspension.matchesRemaining} partido(s) restante(s)
        </p>
        {suspension.notes && (
          <p className="mt-1 text-xs text-muted">{suspension.notes}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!showWaive && (
          <button
            type="button"
            onClick={() => setShowWaive(true)}
            className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium"
          >
            Levantar
          </button>
        )}
        {!showAdjust && (
          <button
            type="button"
            onClick={() => setShowAdjust(true)}
            className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium"
          >
            Ajustar partidos
          </button>
        )}
      </div>

      {showWaive && (
        <form action={waiveAction} className="space-y-2 border-t border-border pt-3">
          <ActionMessage ok={waiveState.ok} message={waiveState.message} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="suspensionId" value={suspension.id} />
          <label className="block text-sm font-medium" htmlFor={`waive-${suspension.id}`}>
            Motivo (obligatorio)
          </label>
          <textarea
            id={`waive-${suspension.id}`}
            name="reason"
            value={waiveReason}
            onChange={(e) => setWaiveReason(e.target.value)}
            required
            rows={2}
            disabled={waivePending}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          {waiveState.fieldErrors?.reason && (
            <p className="text-xs text-danger">{waiveState.fieldErrors.reason}</p>
          )}
          <div className="flex gap-2">
            <SubmitButton pending={waivePending} className="w-auto text-sm">
              Confirmar levantamiento
            </SubmitButton>
            <button
              type="button"
              onClick={() => setShowWaive(false)}
              className="min-h-11 rounded-xl border border-border px-3 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showAdjust && (
        <form action={adjustAction} className="space-y-2 border-t border-border pt-3">
          <ActionMessage ok={adjustState.ok} message={adjustState.message} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="suspensionId" value={suspension.id} />
          <div className="space-y-1.5">
            <label
              htmlFor={`matches-${suspension.id}`}
              className="block text-sm font-medium"
            >
              Partidos restantes
            </label>
            <input
              id={`matches-${suspension.id}`}
              name="matchesRemaining"
              type="number"
              min="0"
              value={matchesRemaining}
              onChange={(e) => setMatchesRemaining(e.target.value)}
              required
              disabled={adjustPending}
              className="min-h-11 w-full max-w-[8rem] rounded-xl border border-border bg-background px-3 text-sm"
            />
            {adjustState.fieldErrors?.matchesRemaining && (
              <p className="text-xs text-danger">
                {adjustState.fieldErrors.matchesRemaining}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`adjust-reason-${suspension.id}`}
              className="block text-sm font-medium"
            >
              Motivo (obligatorio)
            </label>
            <textarea
              id={`adjust-reason-${suspension.id}`}
              name="reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              required
              rows={2}
              disabled={adjustPending}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {adjustState.fieldErrors?.reason && (
              <p className="text-xs text-danger">
                {adjustState.fieldErrors.reason}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <SubmitButton pending={adjustPending} className="w-auto text-sm">
              Guardar ajuste
            </SubmitButton>
            <button
              type="button"
              onClick={() => setShowAdjust(false)}
              className="min-h-11 rounded-xl border border-border px-3 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function CreateAdministrativeSuspensionForm({
  organizationId,
  competitionId,
  seasonId,
  rosterPlayers,
}: Omit<DisciplineAdminPanelProps, "activeSuspensions">) {
  const [state, action, pending] = useActionState(
    createAdministrativeSuspensionAction,
    initialDisciplineActionState
  );

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Crear sanción administrativa"
        description="Sin evento de partido origen. El motivo queda registrado en la sanción."
      />
      <ActionMessage ok={state.ok} message={state.message} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />

        <div className="space-y-1.5">
          <label htmlFor="seasonTeamPlayerId" className="block text-sm font-medium">
            Jugador
          </label>
          <select
            id="seasonTeamPlayerId"
            name="seasonTeamPlayerId"
            required
            disabled={pending || rosterPlayers.length === 0}
            defaultValue=""
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Selecciona jugador
            </option>
            {rosterPlayers.map((p) => (
              <option key={p.seasonTeamPlayerId} value={p.seasonTeamPlayerId}>
                {p.playerName} · {p.teamName}
              </option>
            ))}
          </select>
          {state.fieldErrors?.seasonTeamPlayerId && (
            <p className="text-xs text-danger">
              {state.fieldErrors.seasonTeamPlayerId}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="suspensionType" className="block text-sm font-medium">
              Tipo
            </label>
            <select
              id="suspensionType"
              name="suspensionType"
              defaultValue="administrative"
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {SUSPENSION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="matchesRemaining"
              className="block text-sm font-medium"
            >
              Partidos
            </label>
            <input
              id="matchesRemaining"
              name="matchesRemaining"
              type="number"
              min="0"
              defaultValue="1"
              required
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
            {state.fieldErrors?.matchesRemaining && (
              <p className="text-xs text-danger">
                {state.fieldErrors.matchesRemaining}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-reason" className="block text-sm font-medium">
            Motivo (obligatorio)
          </label>
          <textarea
            id="admin-reason"
            name="reason"
            required
            rows={3}
            disabled={pending}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          {state.fieldErrors?.reason && (
            <p className="text-xs text-danger">{state.fieldErrors.reason}</p>
          )}
        </div>

        <SubmitButton pending={pending} className="w-auto">
          Crear sanción
        </SubmitButton>
      </form>
    </Card>
  );
}

export function DisciplineAdminPanel(props: DisciplineAdminPanelProps) {
  return (
    <div className="space-y-6">
      <CreateAdministrativeSuspensionForm {...props} />
      <div className="space-y-3">
        <SectionHeader
          title="Sanciones activas"
          description="Levantar o ajustar partidos restantes con motivo obligatorio."
        />
        {props.activeSuspensions.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">
              No hay sanciones activas en este momento.
            </p>
          </Card>
        ) : (
          props.activeSuspensions.map((suspension) => (
            <SuspensionAdminActions
              key={suspension.id}
              organizationId={props.organizationId}
              competitionId={props.competitionId}
              seasonId={props.seasonId}
              suspension={suspension}
            />
          ))
        )}
      </div>
    </div>
  );
}
