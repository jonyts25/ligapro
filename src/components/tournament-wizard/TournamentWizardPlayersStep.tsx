"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  wizardAddPlayersAction,
  wizardSkipPlayersAction,
} from "@/lib/tournament-wizard/actions";
import type { WizardSeasonTeam } from "@/lib/tournament-wizard/types";
import { initialTournamentWizardActionState } from "@/lib/tournament-wizard/types";
import {
  hasDuplicateJerseyNumbers,
  parseBulkPlayerLines,
} from "@/lib/teams/parse-bulk-players";
import { BulkPlayersPasteField } from "@/components/teams/BulkPlayersPasteField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

type TeamPlayerDraft = {
  seasonTeamId: string;
  bulkList: string;
};

type TournamentWizardPlayersStepProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  teams: WizardSeasonTeam[];
};

function TeamPlayerBlock({
  team,
  value,
  onChange,
  disabled,
}: {
  team: WizardSeasonTeam;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Card className="space-y-4">
      <SectionHeader
        title={team.name}
        description={
          team.playerCount > 0
            ? `${team.playerCount} jugador(es) ya registrados`
            : "Opcional — puedes dejarlo vacío"
        }
      />

      <BulkPlayersPasteField
        id={`players-${team.seasonTeamId}`}
        name={`players-${team.seasonTeamId}`}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        rows={6}
      />
    </Card>
  );
}

export function TournamentWizardPlayersStep({
  organizationId,
  competitionId,
  seasonId,
  teams,
}: TournamentWizardPlayersStepProps) {
  const [state, formAction, pending] = useActionState(
    wizardAddPlayersAction,
    initialTournamentWizardActionState
  );
  const [skipPending, startSkip] = useTransition();
  const [drafts, setDrafts] = useState<TeamPlayerDraft[]>(() =>
    teams.map((team) => ({ seasonTeamId: team.seasonTeamId, bulkList: "" }))
  );

  const hasBlockingDuplicates = useMemo(
    () =>
      drafts.some((draft) => {
        if (!draft.bulkList.trim()) return false;
        const preview = parseBulkPlayerLines(draft.bulkList);
        return preview.length > 0 && hasDuplicateJerseyNumbers(preview);
      }),
    [drafts]
  );

  const playerEntriesJson = JSON.stringify(
    drafts
      .filter((draft) => draft.bulkList.trim().length > 0)
      .map((draft) => ({
        seasonTeamId: draft.seasonTeamId,
        bulkList: draft.bulkList,
      }))
  );

  function updateDraft(seasonTeamId: string, bulkList: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.seasonTeamId === seasonTeamId ? { ...draft, bulkList } : draft
      )
    );
  }

  function handleSkip() {
    startSkip(async () => {
      await wizardSkipPlayersAction(organizationId, competitionId, seasonId);
    });
  }

  return (
    <div className="space-y-6">
      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="playerEntries" value={playerEntriesJson} />

        {teams.map((team) => {
          const draft = drafts.find((item) => item.seasonTeamId === team.seasonTeamId);
          return (
            <TeamPlayerBlock
              key={team.seasonTeamId}
              team={team}
              value={draft?.bulkList ?? ""}
              onChange={(value) => updateDraft(team.seasonTeamId, value)}
              disabled={pending || skipPending}
            />
          );
        })}

        <div className="flex flex-wrap gap-3">
          <SubmitButton
            pending={pending}
            className="w-auto"
            disabled={hasBlockingDuplicates || skipPending}
          >
            Continuar
          </SubmitButton>
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending || skipPending}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            {skipPending ? "Omitiendo…" : "Omitir por ahora — lo hago después"}
          </button>
          <Link
            href={`/organizaciones/${organizationId}/torneos/asistente/${competitionId}/${seasonId}/equipos`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary"
          >
            Volver
          </Link>
        </div>
      </form>
    </div>
  );
}
