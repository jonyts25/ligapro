"use client";

import { useActionState } from "react";
import {
  assignSeasonRoleAction,
  removeSeasonRoleAction,
} from "@/lib/matches/actions";
import {
  SEASON_ROLE_OPTIONS,
  initialCaptureActionState,
  seasonRoleLabel,
  type OrgMemberOption,
  type SeasonRoleListItem,
} from "@/lib/matches/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";

type SeasonRoleManagerProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  members: OrgMemberOption[];
  roles: SeasonRoleListItem[];
  canManage: boolean;
};

export function SeasonRoleManager({
  organizationId,
  competitionId,
  seasonId,
  members,
  roles,
  canManage,
}: SeasonRoleManagerProps) {
  const [assignState, assignAction, assignPending] = useActionState(
    assignSeasonRoleAction,
    initialCaptureActionState
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeSeasonRoleAction,
    initialCaptureActionState
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <SectionHeader
          title="Roles de temporada"
          description="tournament_admin, referee y delegate para captura controlada."
        />
        {!roles.length ? (
          <EmptyState
            title="Sin roles asignados"
            description="Asigna roles a miembros vigentes de la organización."
          />
        ) : (
          <ul className="space-y-3">
            {roles.map((role) => (
              <li
                key={role.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {role.displayName}
                  </p>
                  <p className="text-xs text-text-secondary">{role.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={seasonRoleLabel(role.role)}
                    variant="info"
                  />
                  {canManage && (
                    <form action={removeAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="competitionId" value={competitionId} />
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="seasonRoleId" value={role.id} />
                      <button
                        type="submit"
                        disabled={removePending}
                        className="min-h-11 rounded-xl border border-border px-3 text-sm"
                      >
                        Retirar
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {(assignState.message || removeState.message) && (
          <p
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              assignState.ok || removeState.ok
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger"
            )}
            role="status"
          >
            {assignState.message || removeState.message}
          </p>
        )}
      </Card>

      {canManage && (
        <Card>
          <form action={assignAction} className="space-y-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="seasonId" value={seasonId} />
            <div className="space-y-1.5">
              <label htmlFor="profileId" className="text-sm font-medium">
                Miembro
              </label>
              <select
                id="profileId"
                name="profileId"
                required
                disabled={assignPending}
                className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
              >
                <option value="">Seleccionar…</option>
                {members.map((m) => (
                  <option key={m.profileId} value={m.profileId}>
                    {m.displayName} ({m.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="role" className="text-sm font-medium">
                Rol
              </label>
              <select
                id="role"
                name="role"
                required
                disabled={assignPending}
                className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
              >
                {SEASON_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton pending={assignPending}>Asignar rol</SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
