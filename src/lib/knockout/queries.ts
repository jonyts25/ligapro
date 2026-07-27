import { createClient } from "@/lib/supabase/server";
import type { KnockoutBracketData, KnockoutRoundRow } from "@/lib/knockout/types";

type UntypedRpc = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function getKnockoutBracketData(
  organizationId: string,
  seasonId: string
): Promise<KnockoutBracketData | null> {
  const supabase = await createClient();

  const { data: roundsRaw } = await supabase
    .from("season_knockout_rounds")
    .select(
      "id, round_number, round_label, bracket_size, is_two_legs"
    )
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .order("round_number", { ascending: true });

  if (!roundsRaw?.length) {
    return {
      rounds: [],
      championSeasonTeamId: null,
      championTeamName: null,
      teamNames: {},
    };
  }

  const roundIds = roundsRaw.map((r) => r.id);

  const [{ data: tiesRaw }, { data: matchesRaw }, { data: teamsRaw }] =
    await Promise.all([
      supabase
        .from("season_knockout_ties")
        .select(
          "id, knockout_round_id, bracket_slot, home_season_team_id, away_season_team_id, penalty_winner_season_team_id"
        )
        .in("knockout_round_id", roundIds)
        .order("bracket_slot", { ascending: true }),
      supabase
        .from("matches")
        .select(
          "id, knockout_round_id, bracket_slot, leg_number, home_season_team_id, away_season_team_id, home_score, away_score, status"
        )
        .eq("season_id", seasonId)
        .not("knockout_round_id", "is", null),
      supabase
        .from("season_teams")
        .select("id, display_name, teams(name)")
        .eq("season_id", seasonId)
        .eq("organization_id", organizationId),
    ]);

  const teamNames: Record<string, string> = {};
  for (const st of teamsRaw ?? []) {
    const rel = st.teams as { name: string } | { name: string }[] | null;
    const base = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    teamNames[st.id] =
      (st.display_name?.trim() || base || "Equipo").trim();
  }

  const matchesByRoundSlot = new Map<string, typeof matchesRaw>();
  for (const m of matchesRaw ?? []) {
    if (!m.knockout_round_id || m.bracket_slot == null) continue;
    const key = `${m.knockout_round_id}:${m.bracket_slot}`;
    const list = matchesByRoundSlot.get(key) ?? [];
    list.push(m);
    matchesByRoundSlot.set(key, list);
  }

  const rounds: KnockoutRoundRow[] = roundsRaw.map((round) => {
    const roundTies = (tiesRaw ?? []).filter(
      (t) => t.knockout_round_id === round.id
    );
    return {
      id: round.id,
      roundNumber: round.round_number,
      roundLabel: round.round_label,
      bracketSize: round.bracket_size,
      isTwoLegs: round.is_two_legs,
      ties: roundTies.map((tie) => {
        const key = `${round.id}:${tie.bracket_slot}`;
        const tieMatches = matchesByRoundSlot.get(key) ?? [];
        return {
          id: tie.id,
          bracketSlot: tie.bracket_slot,
          homeSeasonTeamId: tie.home_season_team_id,
          awaySeasonTeamId: tie.away_season_team_id,
          homeTeamName: teamNames[tie.home_season_team_id] ?? "—",
          awayTeamName: tie.away_season_team_id
            ? teamNames[tie.away_season_team_id] ?? "—"
            : null,
          penaltyWinnerSeasonTeamId: tie.penalty_winner_season_team_id,
          matches: tieMatches.map((m) => ({
            id: m.id,
            bracketSlot: m.bracket_slot!,
            legNumber: m.leg_number ?? 1,
            homeSeasonTeamId: m.home_season_team_id,
            awaySeasonTeamId: m.away_season_team_id,
            homeScore: m.home_score,
            awayScore: m.away_score,
            status: m.status,
          })),
        };
      }),
    };
  });

  const { data: championId } = await (
    supabase as unknown as UntypedRpc
  ).rpc("get_season_knockout_champion", { p_season_id: seasonId });

  const championSeasonTeamId =
    typeof championId === "string" ? championId : null;

  return {
    rounds,
    championSeasonTeamId,
    championTeamName: championSeasonTeamId
      ? teamNames[championSeasonTeamId] ?? null
      : null,
    teamNames,
  };
}

export async function getEligibleTeamCount(
  organizationId: string,
  seasonId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("season_teams")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .in("registration_status", ["registered", "confirmed"]);
  return count ?? 0;
}

export async function hasKnockoutBracket(
  organizationId: string,
  seasonId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("season_knockout_rounds")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId);
  return (count ?? 0) > 0;
}
