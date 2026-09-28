import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database";

import type { SharedSupabaseClient } from "./my-official-match-assignments";

export type PlayerStatsRow = {
  seasonTeamPlayerId: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
};

export type PlayerStatsTotals = Omit<PlayerStatsRow, "seasonTeamPlayerId">;

type RpcRow = {
  season_team_player_id: string;
  matches_played: number;
  goals: number;
  assists: number;
  own_goals: number;
  yellow_cards: number;
  red_cards: number;
};

export function mapPlayerStatsRows(rows: RpcRow[]): PlayerStatsRow[] {
  return rows.map((row) => ({
    seasonTeamPlayerId: row.season_team_player_id,
    matchesPlayed: row.matches_played,
    goals: row.goals,
    assists: row.assists,
    ownGoals: row.own_goals,
    yellowCards: row.yellow_cards,
    redCards: row.red_cards,
  }));
}

export function sumPlayerStatsTotals(rows: PlayerStatsRow[]): PlayerStatsTotals {
  return rows.reduce<PlayerStatsTotals>(
    (acc, row) => ({
      matchesPlayed: acc.matchesPlayed + row.matchesPlayed,
      goals: acc.goals + row.goals,
      assists: acc.assists + row.assists,
      ownGoals: acc.ownGoals + row.ownGoals,
      yellowCards: acc.yellowCards + row.yellowCards,
      redCards: acc.redCards + row.redCards,
    }),
    {
      matchesPlayed: 0,
      goals: 0,
      assists: 0,
      ownGoals: 0,
      yellowCards: 0,
      redCards: 0,
    }
  );
}

export async function fetchMyPlayerStats(
  supabase: SharedSupabaseClient,
  seasonTeamPlayerIds: string[]
): Promise<PlayerStatsRow[]> {
  if (seasonTeamPlayerIds.length === 0) {
    return [];
  }

  const client = supabase as SupabaseClient<Database>;
  const { data, error } = await client.rpc("get_my_player_stats", {
    p_season_team_player_ids: seasonTeamPlayerIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapPlayerStatsRows((data ?? []) as RpcRow[]);
}
