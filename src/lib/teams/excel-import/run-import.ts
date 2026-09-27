import type { SupabaseClient } from "@supabase/supabase-js";
import { bulkPlayerEntriesForRpc } from "@/lib/teams/parse-bulk-players";
import {
  buildOverCapacityWarnings,
  buildTeamJerseyWarnings,
  resolveTeamJerseyNumbers,
  validateMappedImportRows,
} from "@/lib/teams/excel-import/validate-import";
import type {
  ExcelImportSummary,
  MappedImportRow,
} from "@/lib/teams/excel-import/types";

type TeamRecord = { id: string; name: string };

async function findTeamByName(
  supabase: SupabaseClient,
  organizationId: string,
  teamName: string
): Promise<TeamRecord | null> {
  const { data } = await supabase
    .from("teams")
    .select("id, name")
    .eq("organization_id", organizationId)
    .ilike("name", teamName)
    .maybeSingle();

  return data;
}

async function createTeam(
  supabase: SupabaseClient,
  organizationId: string,
  teamName: string
): Promise<TeamRecord> {
  const { data, error } = await supabase
    .from("teams")
    .insert({ organization_id: organizationId, name: teamName })
    .select("id, name")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el equipo.");
  }

  return data;
}

async function findSeasonTeamId(
  supabase: SupabaseClient,
  organizationId: string,
  seasonId: string,
  teamId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("season_teams")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("team_id", teamId)
    .maybeSingle();

  return data?.id ?? null;
}

async function enrollTeamInSeason(
  supabase: SupabaseClient,
  seasonId: string,
  teamId: string
): Promise<string> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ data: string | null; error: { message: string } | null }>;
  }).rpc("enroll_team_in_season", {
    p_season_id: seasonId,
    p_team_id: teamId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

async function getExistingPlayerNames(
  supabase: SupabaseClient,
  seasonTeamId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("season_team_players")
    .select("players(full_name)")
    .eq("season_team_id", seasonTeamId);

  const names = new Set<string>();
  for (const row of data ?? []) {
    const rel = row.players as { full_name: string } | { full_name: string }[] | null;
    const player = Array.isArray(rel) ? rel[0] : rel;
    if (player?.full_name) {
      names.add(player.full_name.trim().toLowerCase());
    }
  }
  return names;
}

async function countActiveRoster(
  supabase: SupabaseClient,
  seasonTeamId: string
): Promise<number> {
  const { count } = await supabase
    .from("season_team_players")
    .select("id", { count: "exact", head: true })
    .eq("season_team_id", seasonTeamId)
    .eq("registration_status", "active");

  return count ?? 0;
}

async function updatePlayerPhone(
  supabase: SupabaseClient,
  organizationId: string,
  seasonTeamId: string,
  playerName: string,
  phone: string
): Promise<void> {
  const { data } = await supabase
    .from("season_team_players")
    .select("player_id, players!inner(full_name)")
    .eq("organization_id", organizationId)
    .eq("season_team_id", seasonTeamId);

  const match = (data ?? []).find((row) => {
    const rel = row.players as { full_name: string } | { full_name: string }[];
    const player = Array.isArray(rel) ? rel[0] : rel;
    return player?.full_name?.trim().toLowerCase() === playerName.trim().toLowerCase();
  });

  if (!match?.player_id) return;

  await supabase
    .from("players")
    .update({ phone: phone.trim() })
    .eq("id", match.player_id)
    .eq("organization_id", organizationId);
}

export async function runExcelImport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  seasonId: string;
  rows: MappedImportRow[];
  maxRosterSize: number | null;
}): Promise<ExcelImportSummary> {
  const { rowsByTeam, skippedRows } = validateMappedImportRows(input.rows);
  let teamsCreated = 0;
  let teamsEnrolled = 0;
  let playersCreated = 0;
  const warnings: string[] = [];
  const teamCounts: Array<{ teamName: string; activeCount: number }> = [];

  for (const [teamName, teamRows] of rowsByTeam) {
    const jerseyWarnings = buildTeamJerseyWarnings(teamRows);
    if (jerseyWarnings.length > 0) {
      for (const row of teamRows) {
        skippedRows.push({
          rowNumber: row.rowNumber,
          reason: jerseyWarnings.join(" "),
        });
      }
      continue;
    }

    let team = await findTeamByName(input.supabase, input.organizationId, teamName);
    if (!team) {
      team = await createTeam(input.supabase, input.organizationId, teamName);
      teamsCreated += 1;
    }

    let seasonTeamId = await findSeasonTeamId(
      input.supabase,
      input.organizationId,
      input.seasonId,
      team.id
    );

    if (!seasonTeamId) {
      seasonTeamId = await enrollTeamInSeason(
        input.supabase,
        input.seasonId,
        team.id
      );
      teamsEnrolled += 1;
    }

    const existingNames = await getExistingPlayerNames(input.supabase, seasonTeamId);
    const resolvedJerseys = resolveTeamJerseyNumbers(teamRows);
    const importableRows: MappedImportRow[] = [];

    for (const row of teamRows) {
      if (existingNames.has(row.jugador.trim().toLowerCase())) {
        skippedRows.push({
          rowNumber: row.rowNumber,
          reason: "El jugador ya está en el plantel del equipo",
        });
        continue;
      }

      importableRows.push(resolvedJerseys.get(row.rowNumber) ?? row);
    }

    if (importableRows.length === 0) {
      continue;
    }

    const bulkList = importableRows
      .map((row) =>
        row.dorsal != null ? `${row.jugador},${row.dorsal}` : row.jugador
      )
      .join("\n");

    const entries = bulkPlayerEntriesForRpc(bulkList);
    const { data, error } = await (input.supabase as unknown as {
      rpc: (
        fn: string,
        args?: Record<string, unknown>
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    }).rpc("create_players_and_add_to_roster_bulk", {
      p_season_team_id: seasonTeamId,
      p_entries: entries,
    });

    if (error) {
      for (const row of importableRows) {
        skippedRows.push({
          rowNumber: row.rowNumber,
          reason: error.message,
        });
      }
      continue;
    }

    const createdCount =
      (data as { created_count?: number } | null)?.created_count ??
      importableRows.length;
    playersCreated += createdCount;

    for (const row of importableRows) {
      if (row.telefono) {
        await updatePlayerPhone(
          input.supabase,
          input.organizationId,
          seasonTeamId,
          row.jugador,
          row.telefono
        );
      }
    }

    teamCounts.push({
      teamName,
      activeCount: await countActiveRoster(input.supabase, seasonTeamId),
    });
  }

  warnings.push(
    ...buildOverCapacityWarnings(teamCounts, input.maxRosterSize)
  );

  return {
    teamsCreated,
    teamsEnrolled,
    playersCreated,
    skippedRows,
    warnings,
  };
}
