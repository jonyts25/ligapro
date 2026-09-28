"use client";

import { useActionState } from "react";
import {
  addExistingPlayerFromDuplicateAction,
  createPlayerAndAddAction,
} from "@/lib/teams/actions";
import {
  duplicateConfirmationMessage,
  type PotentialDuplicatePlayer,
} from "@/lib/teams/player-duplicate-ui";
import { initialTeamsActionState } from "@/lib/teams/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";

type DuplicatePlayerConfirmationCardProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  duplicate: PotentialDuplicatePlayer;
  fullName: string;
  jerseyNumber: string;
  phone: string;
  onDismiss: () => void;
};

export function DuplicatePlayerConfirmationCard({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  duplicate,
  fullName,
  jerseyNumber,
  phone,
  onDismiss,
}: DuplicatePlayerConfirmationCardProps) {
  const [existingState, existingAction, existingPending] = useActionState(
    addExistingPlayerFromDuplicateAction,
    initialTeamsActionState
  );
  const [createState, createAction, createPending] = useActionState(
    createPlayerAndAddAction,
    initialTeamsActionState
  );

  const actionMessage =
    existingState.message || createState.message || null;
  const actionOk = existingState.ok || createState.ok;

  return (
    <Card className="space-y-4 border-warning/40 bg-warning/5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text-primary">
          Posible jugador duplicado
        </p>
        <p className="text-sm text-text-secondary">
          {duplicateConfirmationMessage(duplicate)}
        </p>
      </div>

      {actionMessage ? (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            actionOk
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
          role={actionOk ? "status" : "alert"}
        >
          {actionMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={existingAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
          <input type="hidden" name="playerId" value={duplicate.playerId} />
          <input type="hidden" name="jerseyNumber" value={jerseyNumber} />
          <input type="hidden" name="phone" value={phone} />
          <SubmitButton pending={existingPending} className="w-auto">
            Es la misma persona — usar su registro
          </SubmitButton>
        </form>

        <form action={createAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
          <input type="hidden" name="fullName" value={fullName} />
          <input type="hidden" name="jerseyNumber" value={jerseyNumber} />
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="forceCreateNew" value="true" />
          <SubmitButton pending={createPending} className="w-auto">
            Es alguien distinto — crear nuevo
          </SubmitButton>
        </form>

        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium"
        >
          Cancelar
        </button>
      </div>
    </Card>
  );
}
