"use client";

import { useActionState } from "react";
import { confirmOwnMatchOfficialAction } from "@/lib/matches/actions";
import { initialCaptureActionState } from "@/lib/matches/types";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { cn } from "@/lib/utils/cn";

type MyMatchConfirmAttendanceButtonProps = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  matchOfficialId: string;
};

export function MyMatchConfirmAttendanceButton({
  organizationId,
  competitionId,
  seasonId,
  matchId,
  matchOfficialId,
}: MyMatchConfirmAttendanceButtonProps) {
  const [state, action, pending] = useActionState(
    confirmOwnMatchOfficialAction,
    initialCaptureActionState
  );

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="matchOfficialId" value={matchOfficialId} />
        <SubmitButton pending={pending}>Confirmar mi asistencia</SubmitButton>
      </form>
      {state.message && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            state.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          )}
          role="status"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
