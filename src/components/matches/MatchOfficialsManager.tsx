"use client";

import { useActionState } from "react";
import {
  assignMatchOfficialAction,
  confirmMatchOfficialAction,
  removeMatchOfficialAction,
} from "@/lib/matches/actions";
import {
  MATCH_OFFICIAL_ROLE_OPTIONS,
  initialCaptureActionState,
  officialRoleLabel,
  type MatchOfficialListItem,
  type OrgMemberOption,
} from "@/lib/matches/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";

type MatchOfficialsManagerProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  matchStatus: string;
  members: OrgMemberOption[];
  officials: MatchOfficialListItem[];
  canManage: boolean;
};

export function MatchOfficialsManager({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  matchStatus,
  members,
  officials,
  canManage,
}: MatchOfficialsManagerProps) {
  const [assignState, assignAction, assignPending] = useActionState(
    assignMatchOfficialAction,
    initialCaptureActionState
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmMatchOfficialAction,
    initialCaptureActionState
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMatchOfficialAction,
    initialCaptureActionState
  );

  const canRemove =
    canManage &&
    matchStatus !== "finished" &&
    matchStatus !== "in_progress";

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Oficiales del partido"
        description="La captura requiere asignación confirmada + season_role (árbitro/delegado)."
      />
      {!officials.length ? (
        <EmptyState
          title="Sin oficiales"
          description="Asigna árbitros o delegados elegibles."
        />
      ) : (
        <ul className="space-y-3">
          {officials.map((official) => (
            <li
              key={official.id}
              className="space-y-2 rounded-xl border border-border px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{official.displayName}</p>
                  <p className="text-xs text-text-secondary">{official.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={officialRoleLabel(official.role)}
                    variant="info"
                  />
                  <StatusBadge
                    label={
                      official.status === "confirmed"
                        ? "Confirmado"
                        : official.status === "declined"
                          ? "Rechazado"
                          : "Asignado"
                    }
                    variant={
                      official.status === "confirmed" ? "success" : "warning"
                    }
                  />
                </div>
              </div>
              {!official.hasRequiredSeasonRole &&
                (official.role === "referee" ||
                  official.role === "delegate") && (
                  <p className="text-xs text-warning">
                    Falta season_role coincidente; no podrá capturar.
                  </p>
                )}
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {official.status !== "confirmed" && (
                    <form action={confirmAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="competitionId" value={competitionId} />
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="matchId" value={matchId} />
                      <input
                        type="hidden"
                        name="matchOfficialId"
                        value={official.id}
                      />
                      <button
                        type="submit"
                        disabled={confirmPending}
                        className="min-h-11 rounded-xl bg-brand px-3 text-sm font-semibold text-brand-foreground"
                      >
                        Confirmar
                      </button>
                    </form>
                  )}
                  {canRemove && (
                    <form action={removeAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="competitionId" value={competitionId} />
                      <input type="hidden" name="seasonId" value={seasonId} />
                      <input type="hidden" name="matchId" value={matchId} />
                      <input
                        type="hidden"
                        name="matchOfficialId"
                        value={official.id}
                      />
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
              )}
            </li>
          ))}
        </ul>
      )}

      {(assignState.message ||
        confirmState.message ||
        removeState.message) && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            assignState.ok || confirmState.ok || removeState.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
        >
          {assignState.message ||
            confirmState.message ||
            removeState.message}
        </p>
      )}

      {canManage && (
        <form action={assignAction} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="matchId" value={matchId} />
          <div className="space-y-1.5">
            <label htmlFor="officialProfileId" className="text-sm font-medium">
              Miembro
            </label>
            <select
              id="officialProfileId"
              name="profileId"
              required
              disabled={assignPending}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="">Seleccionar…</option>
              {members.map((m) => (
                <option key={m.profileId} value={m.profileId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="officialRole" className="text-sm font-medium">
              Rol en el partido
            </label>
            <select
              id="officialRole"
              name="role"
              required
              disabled={assignPending}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              {MATCH_OFFICIAL_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton pending={assignPending}>Asignar oficial</SubmitButton>
        </form>
      )}
    </Card>
  );
}
