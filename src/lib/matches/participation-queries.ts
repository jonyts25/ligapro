import { createClient } from "@/lib/supabase/server";
import type { MatchParticipantRow } from "@/lib/matches/participation-types";
import { mapParticipationRows } from "@/lib/matches/participation-validation";

type UntypedMatchParticipantsClient = {
  from: (table: "match_participants") => {
    select: (query: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        eq: (
          column: string,
          value: string
        ) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => PromiseLike<{
            data: Parameters<typeof mapParticipationRows>[0] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

/**
 * Shared read models for match participation.
 * Steps 1.2, 1.5, 1.6, 1.7 and 1.8 should reuse these queries instead of
 * duplicating joins against match_participants.
 */

export async function getMatchParticipants(
  organizationId: string,
  matchId: string
): Promise<MatchParticipantRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as UntypedMatchParticipantsClient)
    .from("match_participants")
    .select(
      `
      id,
      match_id,
      season_team_player_id,
      organization_id,
      status,
      called_by_profile_id,
      responded_at,
      created_at,
      updated_at,
      season_team_players (
        season_team_id,
        jersey_number,
        players ( full_name )
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return mapParticipationRows(data ?? []);
}

export async function getPlayerParticipationHistory(
  organizationId: string,
  seasonTeamPlayerId: string
): Promise<{ playedCount: number }> {
  const supabase = await createClient();
  const { count, error } = await (
    supabase as unknown as {
      from: (table: "match_participants") => {
        select: (
          columns: string,
          options: { count: "exact"; head: true }
        ) => {
          eq: (
            column: string,
            value: string
          ) => {
            eq: (
              column: string,
              value: string
            ) => {
              eq: (
                column: string,
                value: string
              ) => PromiseLike<{
                count: number | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    }
  )
    .from("match_participants")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("season_team_player_id", seasonTeamPlayerId)
    .eq("status", "played");

  if (error) {
    throw new Error(error.message);
  }

  return { playedCount: count ?? 0 };
}
