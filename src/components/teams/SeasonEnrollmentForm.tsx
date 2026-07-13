"use client";

import { useActionState } from "react";
import Link from "next/link";
import { enrollTeamAction } from "@/lib/teams/actions";
import {
  SEASON_TEAM_STATUS_OPTIONS,
  initialTeamsActionState,
  type TeamRecord,
} from "@/lib/teams/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type SeasonEnrollmentFormProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  availableTeams: TeamRecord[];
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-danger" role="alert">
      {message}
    </p>
  );
}

export function SeasonEnrollmentForm({
  organizationId,
  competitionId,
  seasonId,
  availableTeams,
}: SeasonEnrollmentFormProps) {
  const [state, formAction, pending] = useActionState(
    enrollTeamAction,
    initialTeamsActionState
  );

  const v = state.values;

  return (
    <Card className="space-y-5">
      <SectionHeader
        title="Inscribir equipo"
        description="Selecciona un equipo de la organización para esta temporada."
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

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />

        <div className="space-y-1.5">
          <label htmlFor="teamId" className="block text-sm font-medium">
            Equipo
          </label>
          <select
            id="teamId"
            name="teamId"
            required
            disabled={pending || availableTeams.length === 0}
            defaultValue={String(v?.teamId ?? "")}
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              state.fieldErrors?.teamId && "border-danger"
            )}
          >
            <option value="">Selecciona un equipo</option>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.teamId} />
          {availableTeams.length === 0 && (
            <p className="text-sm text-muted">
              No hay equipos disponibles para inscribir.{" "}
              <Link
                href={`/organizaciones/${organizationId}/equipos/nuevo`}
                className="font-medium text-organization-accent"
              >
                Crear equipo
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="displayName" className="block text-sm font-medium">
            Nombre para mostrar{" "}
            <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            disabled={pending}
            defaultValue={String(v?.displayName ?? "")}
            maxLength={100}
            placeholder="Ej. Halcones A"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="groupName" className="block text-sm font-medium">
            Grupo <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="groupName"
            name="groupName"
            disabled={pending}
            defaultValue={String(v?.groupName ?? "")}
            maxLength={100}
            placeholder="Grupo A"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="registrationStatus"
            className="block text-sm font-medium"
          >
            Estado de inscripción
          </label>
          <select
            id="registrationStatus"
            name="registrationStatus"
            disabled={pending}
            defaultValue={String(v?.registrationStatus ?? "registered")}
            className={cn(
              "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm",
              state.fieldErrors?.registrationStatus && "border-danger"
            )}
          >
            {SEASON_TEAM_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.registrationStatus} />
        </div>

        <div className="flex flex-wrap gap-3">
          <SubmitButton
            pending={pending}
            className="w-auto"
            disabled={availableTeams.length === 0}
          >
            Inscribir equipo
          </SubmitButton>
          <Link
            href={`/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/equipos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Cancelar
          </Link>
        </div>
      </form>

      <p className="text-sm text-muted">
        ¿No encuentras el equipo?{" "}
        <Link
          href={`/organizaciones/${organizationId}/equipos/nuevo`}
          className="font-medium text-organization-accent"
        >
          Crear equipo
        </Link>
      </p>
    </Card>
  );
}
