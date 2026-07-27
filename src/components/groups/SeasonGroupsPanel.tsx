"use client";

import { useActionState, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import {
  assignTeamsToGroupsAction,
  createGroupFixturesAction,
  setSeasonGroupsAction,
} from "@/lib/groups/actions";
import { generateKnockoutFromGroupsAction } from "@/lib/knockout/actions";
import type { GroupsPhaseData } from "@/lib/groups/types";
import { initialGroupsActionState } from "@/lib/groups/types";
import { initialKnockoutActionState } from "@/lib/knockout/types";
import Link from "next/link";

type SeasonGroupsPanelProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  data: GroupsPhaseData;
};

function ActionMessage({
  message,
  ok,
  details,
}: {
  message: string | null;
  ok: boolean;
  details?: string[];
}) {
  if (!message && !details?.length) return null;
  return (
    <div className="space-y-2">
      {message && (
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
      )}
      {details && details.length > 0 && (
        <ul className="list-inside list-disc text-xs text-text-secondary">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SeasonGroupsPanel({
  organizationId,
  competitionId,
  seasonId,
  data,
}: SeasonGroupsPanelProps) {
  const [groupsState, groupsAction, groupsPending] = useActionState(
    setSeasonGroupsAction,
    initialGroupsActionState
  );
  const [assignState, assignAction, assignPending] = useActionState(
    assignTeamsToGroupsAction,
    initialGroupsActionState
  );
  const [fixtureState, fixtureAction, fixturePending] = useActionState(
    createGroupFixturesAction,
    initialGroupsActionState
  );
  const [knockoutState, knockoutAction, knockoutPending] = useActionState(
    generateKnockoutFromGroupsAction,
    initialKnockoutActionState
  );

  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of data.teams) {
      init[t.seasonTeamId] = t.seasonGroupId ?? "";
    }
    return init;
  });

  const hidden = (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
    </>
  );

  const defaultGroupNames = data.groups.map((g) => g.name).join("\n");

  const incompleteGroups = useMemo(
    () => data.fixtureStatus.filter((g) => g.unfinishedCount > 0),
    [data.fixtureStatus]
  );

  const canGenerateKnockout =
    data.groups.length > 0 &&
    data.fixtureStatus.every(
      (g) => g.hasFixture && g.unfinishedCount === 0 && g.teamCount >= 2
    ) &&
    !data.hasKnockoutBracket;

  const bracketBase = `/organizaciones/${organizationId}/torneos/${competitionId}/temporadas/${seasonId}/bracket`;

  return (
    <div className="space-y-6">
      {data.hasKnockoutBracket && (
        <Card className="border-organization-accent/30 bg-organization-accent/10 p-4">
          <p className="text-sm text-text-primary">
            La eliminatoria ya fue generada.{" "}
            <Link
              href={bracketBase}
              className="font-medium text-organization-accent underline-offset-2 hover:underline"
            >
              Ver bracket
            </Link>
          </p>
        </Card>
      )}

      {!data.hasKnockoutBracket && (
        <>
          <Card className="space-y-4 p-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Definir grupos
            </h2>
            <p className="text-sm text-text-secondary">
              Un nombre por línea. Guardar <strong>reemplaza</strong> la lista
              anterior por completo (no la complementa).
            </p>
            <form action={groupsAction} className="space-y-3">
              {hidden}
              <textarea
                name="groupNames"
                rows={4}
                defaultValue={defaultGroupNames}
                disabled={groupsPending}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder={"Grupo A\nGrupo B"}
              />
              <SubmitButton pending={groupsPending}>
                Guardar grupos
              </SubmitButton>
            </form>
            <ActionMessage
              message={groupsState.message}
              ok={groupsState.ok}
            />
          </Card>

          {data.groups.length > 0 && (
            <Card className="space-y-4 p-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Asignar equipos
              </h2>
              <form action={assignAction} className="space-y-3">
                {hidden}
                <input
                  type="hidden"
                  name="assignments"
                  value={JSON.stringify(
                    data.teams.map((t) => ({
                      season_team_id: t.seasonTeamId,
                      group_id: assignments[t.seasonTeamId] || null,
                    }))
                  )}
                />
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {data.teams.map((team) => (
                    <li
                      key={team.seasonTeamId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="text-sm font-medium">
                        {team.teamName}
                      </span>
                      <select
                        value={assignments[team.seasonTeamId] ?? ""}
                        onChange={(e) =>
                          setAssignments((prev) => ({
                            ...prev,
                            [team.seasonTeamId]: e.target.value,
                          }))
                        }
                        disabled={assignPending}
                        className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm"
                      >
                        <option value="">Sin grupo</option>
                        {data.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
                <SubmitButton pending={assignPending}>
                  Guardar asignaciones
                </SubmitButton>
              </form>
              <ActionMessage
                message={assignState.message}
                ok={assignState.ok}
              />
            </Card>
          )}

          {data.groups.length > 0 && (
            <Card className="space-y-4 p-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Fixture por grupo
              </h2>
              <ul className="space-y-2 text-sm text-text-secondary">
                {data.fixtureStatus.map((g) => (
                  <li key={g.groupId}>
                    <span className="font-medium text-text-primary">
                      {g.groupName}
                    </span>
                    {" — "}
                    {g.teamCount} equipos, {g.matchCount} partidos
                    {g.unfinishedCount > 0 &&
                      ` (${g.unfinishedCount} sin resultado)`}
                    {g.hasFixture ? " · fixture generado" : " · sin fixture"}
                  </li>
                ))}
              </ul>
              <form action={fixtureAction}>
                {hidden}
                <SubmitButton pending={fixturePending}>
                  Generar fixture de todos los grupos
                </SubmitButton>
              </form>
              <ActionMessage
                message={fixtureState.message}
                ok={fixtureState.ok}
                details={fixtureState.details}
              />
            </Card>
          )}

          {data.groups.length > 0 && (
            <Card className="space-y-4 p-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Pasar a eliminatoria
              </h2>
              {data.groupsAdvancePerGroup != null && (
                <p className="text-sm text-text-secondary">
                  Clasifican {data.groupsAdvancePerGroup} equipo(s) por grupo.
                </p>
              )}
              {canGenerateKnockout ? (
                <form action={knockoutAction}>
                  {hidden}
                  <SubmitButton pending={knockoutPending}>
                    Generar eliminatoria
                  </SubmitButton>
                </form>
              ) : (
                <p className="text-sm text-text-secondary">
                  {incompleteGroups.length > 0
                    ? `Faltan resultados en: ${incompleteGroups.map((g) => g.groupName).join(", ")}.`
                    : data.fixtureStatus.some((g) => !g.hasFixture)
                      ? "Genera el fixture de todos los grupos antes de continuar."
                      : data.fixtureStatus.some((g) => g.teamCount < 2)
                        ? "Cada grupo necesita al menos 2 equipos asignados."
                        : "Completa la fase de grupos para generar la eliminatoria."}
                </p>
              )}
              <ActionMessage
                message={knockoutState.message}
                ok={knockoutState.ok}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
