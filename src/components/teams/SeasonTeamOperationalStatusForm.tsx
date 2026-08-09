"use client";

import { useActionState } from "react";
import {
  initialTeamsActionState,
  SEASON_TEAM_OPERATIONAL_STATUS_OPTIONS,
  seasonTeamOperationalStatusLabel,
  seasonTeamOperationalStatusVariant,
  type SeasonTeamOperationalStatus,
} from "@/lib/teams/types";
import { setSeasonTeamStatusAction } from "@/lib/teams/actions";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

type SeasonTeamOperationalStatusFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  currentStatus: SeasonTeamOperationalStatus;
  canManage: boolean;
};

export function SeasonTeamOperationalStatusForm({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  currentStatus,
  canManage,
}: SeasonTeamOperationalStatusFormProps) {
  const [state, formAction, pending] = useActionState(
    setSeasonTeamStatusAction,
    initialTeamsActionState
  );

  if (!canManage) {
    return (
      <StatusBadge
        label={seasonTeamOperationalStatusLabel(currentStatus)}
        variant={seasonTeamOperationalStatusVariant(currentStatus)}
      />
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Estado operativo:</span>
        <StatusBadge
          label={seasonTeamOperationalStatusLabel(currentStatus)}
          variant={seasonTeamOperationalStatusVariant(currentStatus)}
        />
      </div>
      {state.message && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {state.message}
        </p>
      )}
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
        <div className="space-y-1.5">
          <label htmlFor="status" className="block text-sm font-medium">
            Nuevo estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={currentStatus}
            disabled={pending}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {SEASON_TEAM_OPERATIONAL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="reason" className="block text-sm font-medium">
            Razón (obligatoria)
          </label>
          <input
            id="reason"
            name="reason"
            required
            disabled={pending}
            placeholder="Ej. baja voluntaria del club"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <SubmitButton pending={pending} className="w-auto sm:col-span-2">
          Cambiar estado
        </SubmitButton>
      </form>
      <p className="text-xs text-text-secondary">
        Al marcar retirado se anulan los partidos programados futuros contra
        este equipo.
      </p>
    </Card>
  );
}
