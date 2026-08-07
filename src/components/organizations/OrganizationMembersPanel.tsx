"use client";

import { useActionState } from "react";
import {
  assignOrganizationMemberSeasonScopeAction,
  initialOrganizationMembersActionState,
  removeOrganizationMemberSeasonScopeAction,
} from "@/lib/organization-members/actions";
import type {
  OrganizationMemberListItem,
  OrganizationSeasonScopeOption,
} from "@/lib/organization-members/types";
import { roleLabel } from "@/lib/auth/validation";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils/cn";

type OrganizationMembersPanelProps = {
  organizationId: string;
  members: OrganizationMemberListItem[];
  seasonOptions: OrganizationSeasonScopeOption[];
  canManageScopes: boolean;
};

function scopeAccessLabel(member: OrganizationMemberListItem): string {
  if (member.role !== "organization_admin") {
    return "";
  }
  if (member.seasonScopes.length === 0) {
    return "Toda la organización";
  }
  return `Acotado (${member.seasonScopes.length} temporada${
    member.seasonScopes.length === 1 ? "" : "s"
  })`;
}

export function OrganizationMembersPanel({
  organizationId,
  members,
  seasonOptions,
  canManageScopes,
}: OrganizationMembersPanelProps) {
  const [assignState, assignAction, assignPending] = useActionState(
    assignOrganizationMemberSeasonScopeAction,
    initialOrganizationMembersActionState
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeOrganizationMemberSeasonScopeAction,
    initialOrganizationMembersActionState
  );

  const actionMessage = assignState.message || removeState.message;
  const actionOk = assignState.ok || removeState.ok;

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4 text-sm text-text-secondary">
        <p>
          Los administradores <strong>sin scopes</strong> tienen acceso a toda
          la organización, como hoy.
        </p>
        <p>
          Un scope de <strong>temporada</strong> limita hoy solo a: editar esa
          temporada, programar sus partidos y anular eventos de esos partidos.
        </p>
        <p>
          Roster, disciplina, finanzas de equipo, reservas de cancha y brackets
          siguen sin acotar — un admin con scope de temporada aún tiene acceso
          de organización completa para esas áreas (Wave 1, ver ADR-0013).
        </p>
      </Card>

      {actionMessage && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            actionOk
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={actionOk ? "status" : "alert"}
        >
          {actionMessage}
        </p>
      )}

      <Card className="overflow-hidden">
        <SectionHeader
          title="Miembros"
          description="Owner, administradores y miembros de la organización."
          className="border-b border-border px-4 py-4"
        />
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const isScopedAdmin = member.role === "organization_admin";
            const assignedSeasonIds = new Set(
              member.seasonScopes.map((scope) => scope.seasonId)
            );
            const availableSeasonOptions = seasonOptions.filter(
              (option) => !assignedSeasonIds.has(option.seasonId)
            );

            return (
              <li key={member.memberId} className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {member.displayName}
                    </p>
                    <p className="text-xs text-text-secondary">{member.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={roleLabel(member.role)}
                      variant={
                        member.role === "organization_owner"
                          ? "success"
                          : member.role === "organization_admin"
                            ? "info"
                            : "warning"
                      }
                    />
                    {isScopedAdmin && (
                      <StatusBadge
                        label={scopeAccessLabel(member)}
                        variant={
                          member.seasonScopes.length === 0 ? "success" : "warning"
                        }
                      />
                    )}
                  </div>
                </div>

                {isScopedAdmin && (
                  <div className="space-y-3 rounded-xl border border-border bg-surface px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Scopes de temporada
                    </p>

                    {member.seasonScopes.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        Sin temporadas asignadas — administra toda la
                        organización.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {member.seasonScopes.map((scope) => (
                          <li
                            key={scope.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                          >
                            <span className="text-sm text-text-primary">
                              {scope.seasonName}
                            </span>
                            {canManageScopes && (
                              <form action={removeAction}>
                                <input
                                  type="hidden"
                                  name="organizationId"
                                  value={organizationId}
                                />
                                <input
                                  type="hidden"
                                  name="scopeId"
                                  value={scope.id}
                                />
                                <button
                                  type="submit"
                                  disabled={removePending}
                                  className="min-h-11 rounded-xl border border-border px-3 text-sm text-text-secondary hover:bg-surface-elevated"
                                >
                                  Quitar
                                </button>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {canManageScopes && availableSeasonOptions.length > 0 && (
                      <form
                        action={assignAction}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="organizationId"
                          value={organizationId}
                        />
                        <input
                          type="hidden"
                          name="organizationMemberId"
                          value={member.memberId}
                        />
                        <div className="min-w-[14rem] flex-1 space-y-1">
                          <label
                            htmlFor={`season-${member.memberId}`}
                            className="text-xs font-medium text-text-secondary"
                          >
                            Agregar temporada
                          </label>
                          <select
                            id={`season-${member.memberId}`}
                            name="seasonId"
                            required
                            disabled={assignPending}
                            className="min-h-11 w-full rounded-xl border border-border bg-background px-2 text-sm"
                          >
                            <option value="">Seleccionar…</option>
                            {availableSeasonOptions.map((option) => (
                              <option
                                key={option.seasonId}
                                value={option.seasonId}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <SubmitButton pending={assignPending} className="w-auto px-4">
                          Asignar
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
