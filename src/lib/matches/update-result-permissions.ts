import {
  allowedStatusTransitions,
  type MatchStatusValue,
} from "@/lib/matches/types";

export type UpdateResultAuthInput = {
  isOrgAdmin: boolean;
  isTournamentAdmin: boolean;
  isConfirmedReferee: boolean;
  currentMatchStatus: MatchStatusValue;
};

export type UpdateResultPermissions = {
  canUpdateResult: boolean;
  /** When true, UI/action only allow closing to finished/walkover (no reopen/cancel). */
  closeOnlyResultUpdate: boolean;
};

const CLOSE_ONLY_STATUSES: MatchStatusValue[] = ["finished", "walkover"];

export function isResultClosedStatus(status: MatchStatusValue): boolean {
  return status === "finished" || status === "walkover" || status === "cancelled";
}

export function resolveUpdateResultPermissions(
  input: UpdateResultAuthInput
): UpdateResultPermissions {
  if (input.isOrgAdmin || input.isTournamentAdmin) {
    return { canUpdateResult: true, closeOnlyResultUpdate: false };
  }

  if (input.isConfirmedReferee) {
    return {
      canUpdateResult: !isResultClosedStatus(input.currentMatchStatus),
      closeOnlyResultUpdate: true,
    };
  }

  return { canUpdateResult: false, closeOnlyResultUpdate: false };
}

export function validateUpdateResultAuthorization(input: {
  isOrgAdmin: boolean;
  isTournamentAdmin: boolean;
  isConfirmedReferee: boolean;
  statusRaw: MatchStatusValue;
  currentStatus: MatchStatusValue;
}): { ok: true } | { ok: false; message: string } {
  const privileged = input.isOrgAdmin || input.isTournamentAdmin;

  if (!privileged && !input.isConfirmedReferee) {
    return {
      ok: false,
      message:
        "Solo owner/admin, admin de torneo o árbitro confirmado del partido pueden actualizar el marcador.",
    };
  }

  if (input.isConfirmedReferee && !privileged) {
    if (isResultClosedStatus(input.currentStatus)) {
      return {
        ok: false,
        message: "El árbitro no puede modificar un resultado ya cerrado.",
      };
    }

    if (!CLOSE_ONLY_STATUSES.includes(input.statusRaw)) {
      return {
        ok: false,
        message:
          "Como árbitro solo puedes cerrar el partido (finalizado o walkover).",
      };
    }
  }

  return { ok: true };
}

export function allowedStatusTransitionsForRole(
  current: MatchStatusValue,
  closeOnly: boolean
): MatchStatusValue[] {
  if (!closeOnly) {
    return allowedStatusTransitions(current);
  }

  switch (current) {
    case "scheduled":
      return ["scheduled", "finished", "walkover"];
    case "in_progress":
      return ["in_progress", "finished", "walkover"];
    case "finished":
      return ["finished"];
    case "cancelled":
      return ["cancelled"];
    case "walkover":
      return ["walkover"];
    default:
      return [current];
  }
}
