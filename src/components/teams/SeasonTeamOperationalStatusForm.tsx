"use client";

import { useActionState } from "react";
import { setSeasonTeamOperationalStatusAction } from "@/lib/teams/actions";
import {
  initialTeamsActionState,
  SEASON_TEAM_OPERATIONAL_STATUS_OPTIONS,
  type SeasonTeamOperationalStatus,
} from "@/lib/teams/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

type SeasonTeamOperationalStatusFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  seasonTeamId: string;
  currentStatus: SeasonTeamOperationalStatus;
};

export function SeasonTeamOperationalStatusForm({
  organizationId,
  competitionId,
  seasonId,
  seasonTeamId,
  currentStatus,
}: SeasonTeamOperationalStatusFormProps) {
  const [state, formAction, pending] = useActionState(
    setSeasonTeamOperationalStatusAction,
    initialTeamsActionState
  );

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Estado en temporada"
        description="Retirar un equipo anula sus partidos futuros programados. Requiere motivo."
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
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="seasonTeamId" value={seasonTeamId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="operationalStatus" className="block text-sm font-medium">
              Estado operativo
            </label>
            <select
              id="operationalStatus"
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
            <label htmlFor="statusReason" className="block text-sm font-medium">
              Motivo (obligatorio)
            </label>
            <input
              id="statusReason"
              name="reason"
              required
              minLength={3}
              disabled={pending}
              placeholder="Ej. baja voluntaria del club"
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
        </div>
        <SubmitButton pending={pending} className="w-auto">
          Actualizar estado
        </SubmitButton>
      </form>
    </Card>
  );
}
