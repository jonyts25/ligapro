import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  buildRosterImportInsertRows,
  buildRosterImportOverCapacityWarning,
  selectActivePlayersForImport,
} from "@/lib/teams/roster-import";

type ImportRosterResult = {
  importedCount: number;
  skippedCount: number;
  overCapacityWarning: string | null;
};

export async function importRosterToSeasonTeam(
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    targetSeasonId: string;
    targetSeasonTeamId: string;
    sourceSeasonTeamId: string;
    teamId: string;
    maxRosterSize: number | null;
  }
): Promise<ImportRosterResult> {
  const { data: sourceSeasonTeam } = await supabase
    .from("season_teams")
    .select("id, team_id, season_id, organization_id")
    .eq("id", input.sourceSeasonTeamId)
    .maybeSingle();

  if (
    !sourceSeasonTeam ||
    sourceSeasonTeam.organization_id !== input.organizationId ||
    sourceSeasonTeam.team_id !== input.teamId
  ) {
    throw new Error("La fuente de importación no es válida.");
  }

  if (sourceSeasonTeam.season_id === input.targetSeasonId) {
    throw new Error("No puedes importar desde el mismo torneo.");
  }

  const { data: sourceRows } = await supabase
    .from("season_team_players")
    .select(
      "player_id, jersey_number, registration_status, players(full_name)"
    )
    .eq("season_team_id", input.sourceSeasonTeamId)
    .eq("organization_id", input.organizationId);

  const activePlayers = selectActivePlayersForImport(
    (sourceRows ?? []).map((row) => {
      const playerRel = row.players as
        | { full_name: string }
        | { full_name: string }[]
        | null;
      const player = Array.isArray(playerRel) ? playerRel[0] : playerRel;
      return {
        playerId: row.player_id,
        fullName: player?.full_name ?? "Jugador",
        jerseyNumber: row.jersey_number,
        registrationStatus: row.registration_status,
      };
    })
  );

  const insertRows = buildRosterImportInsertRows(activePlayers);
  let importedCount = 0;
  let skippedCount = 0;

  for (const row of insertRows) {
    const { error } = await supabase.rpc("add_player_to_season_team", {
      p_season_team_id: input.targetSeasonTeamId,
      p_player_id: row.playerId,
      p_jersey_number: row.jerseyNumber ?? undefined,
      p_registration_status: row.registrationStatus,
    });

    if (error) {
      skippedCount += 1;
      continue;
    }

    importedCount += 1;
  }

  return {
    importedCount,
    skippedCount,
    overCapacityWarning: buildRosterImportOverCapacityWarning(
      importedCount,
      input.maxRosterSize
    ),
  };
}
