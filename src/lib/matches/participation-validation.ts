import type { MatchStatusValue } from "@/lib/matches/types";
import {
  MATCH_PARTICIPATION_STATUS_OPTIONS,
  type MatchParticipationStatus,
} from "@/lib/matches/participation-types";

const SETTABLE_PARTICIPATION_STATUSES = new Set<MatchParticipationStatus>([
  "called",
  "confirmed",
  "declined",
]);

export function isMatchParticipationClosed(status: MatchStatusValue): boolean {
  return status === "finished" || status === "walkover" || status === "cancelled";
}

export function parseSeasonTeamPlayerIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.trim() === "") {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseParticipationStatus(
  raw: FormDataEntryValue | null
): MatchParticipationStatus | null {
  const value = String(raw ?? "").trim();
  if (
    MATCH_PARTICIPATION_STATUS_OPTIONS.some(
      (option) => option.value === value && SETTABLE_PARTICIPATION_STATUSES.has(option.value)
    )
  ) {
    return value as MatchParticipationStatus;
  }
  return null;
}

export function validateSetMatchParticipantsInput(input: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  seasonTeamPlayerIds: string[];
  status: MatchParticipationStatus | null;
}):
  | { ok: true }
  | { ok: false; message: string } {
  if (
    !input.organizationId ||
    !input.competitionId ||
    !input.seasonId ||
    !input.matchId
  ) {
    return { ok: false, message: "Faltan datos del partido." };
  }

  if (input.seasonTeamPlayerIds.length === 0) {
    return { ok: false, message: "Selecciona al menos un jugador." };
  }

  if (!input.status || !SETTABLE_PARTICIPATION_STATUSES.has(input.status)) {
    return { ok: false, message: "Estado de participación inválido." };
  }

  return { ok: true };
}

export function validateValidateMatchRosterInput(input: {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  matchId: string;
  seasonTeamPlayerIds: string[];
}):
  | { ok: true }
  | { ok: false; message: string } {
  if (
    !input.organizationId ||
    !input.competitionId ||
    !input.seasonId ||
    !input.matchId
  ) {
    return { ok: false, message: "Faltan datos del partido." };
  }

  if (input.seasonTeamPlayerIds.length === 0) {
    return { ok: false, message: "Selecciona al menos un jugador para validar." };
  }

  return { ok: true };
}

export function mapParticipationRows(
  rows: Array<{
    id: string;
    match_id: string;
    season_team_player_id: string;
    organization_id: string;
    status: string;
    called_by_profile_id: string | null;
    responded_at: string | null;
    created_at: string;
    updated_at: string;
    season_team_players: {
      season_team_id: string;
      jersey_number: number | null;
      players: { full_name: string } | { full_name: string }[] | null;
    } | null;
  }>
): import("@/lib/matches/participation-types").MatchParticipantRow[] {
  return rows.map((row) => {
    const stp = row.season_team_players;
    const playerRel = stp?.players;
    const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;

    return {
      id: row.id,
      matchId: row.match_id,
      seasonTeamPlayerId: row.season_team_player_id,
      seasonTeamId: stp?.season_team_id ?? "",
      organizationId: row.organization_id,
      status: row.status as MatchParticipationStatus,
      calledByProfileId: row.called_by_profile_id,
      respondedAt: row.responded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      playerName: player?.full_name ?? "Jugador",
      jerseyNumber: stp?.jersey_number ?? null,
    };
  });
}
