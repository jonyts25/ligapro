import { createClient } from "@/lib/supabase/server";
import { hasKnockoutBracket } from "@/lib/knockout/queries";
import type { GroupsPhaseData, GroupFixtureStatus } from "@/lib/groups/types";

export async function getGroupsPhaseData(
  organizationId: string,
  seasonId: string
): Promise<GroupsPhaseData> {
  const supabase = await createClient();

  const [
    { data: groups },
    { data: teams },
    { data: rules },
    hasBracket,
  ] = await Promise.all([
    supabase
      .from("season_groups")
      .select("id, name")
      .eq("season_id", seasonId)
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("season_teams")
      .select("id, display_name, registration_status, season_group_id, teams(name)")
      .eq("season_id", seasonId)
      .eq("organization_id", organizationId)
      .in("registration_status", ["registered", "confirmed"])
      .order("created_at"),
    supabase
      .from("season_rules")
      .select("groups_advance_per_group")
      .eq("season_id", seasonId)
      .maybeSingle(),
    hasKnockoutBracket(organizationId, seasonId),
  ]);

  const groupRows = (groups ?? []).map((g) => ({ id: g.id, name: g.name }));

  const teamRows = (teams ?? []).map((st) => {
    const rel = st.teams as { name: string } | { name: string }[] | null;
    const base = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    const group = groupRows.find((g) => g.id === st.season_group_id);
    return {
      seasonTeamId: st.id,
      teamName: (st.display_name?.trim() || base || "Equipo").trim(),
      registrationStatus: st.registration_status,
      seasonGroupId: st.season_group_id,
      groupName: group?.name ?? null,
    };
  });

  const fixtureStatus: GroupFixtureStatus[] = [];
  for (const group of groupRows) {
    const assigned = teamRows.filter((t) => t.seasonGroupId === group.id);
    const { count: matchCount } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("season_id", seasonId)
      .eq("season_group_id", group.id)
      .is("knockout_round_id", null);

    const { count: unfinishedCount } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("season_id", seasonId)
      .eq("season_group_id", group.id)
      .is("knockout_round_id", null)
      .or(
        "status.not.in.(finished,walkover),home_score.is.null,away_score.is.null"
      );

    fixtureStatus.push({
      groupId: group.id,
      groupName: group.name,
      teamCount: assigned.length,
      matchCount: matchCount ?? 0,
      unfinishedCount: unfinishedCount ?? 0,
      hasFixture: (matchCount ?? 0) > 0,
    });
  }

  return {
    groups: groupRows,
    teams: teamRows,
    groupsAdvancePerGroup: rules?.groups_advance_per_group ?? null,
    fixtureStatus,
    hasKnockoutBracket: hasBracket,
  };
}

export async function getSeasonGroupsForStandings(
  organizationId: string,
  seasonId: string
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_groups")
    .select("id, name")
    .eq("season_id", seasonId)
    .eq("organization_id", organizationId)
    .order("name");
  return (data ?? []).map((g) => ({ id: g.id, name: g.name }));
}

export async function getPublicSeasonGroupsList(
  organizationId: string,
  seasonSlug: string
) {
  type UntypedRpc = {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const supabase = await createClient();
  const { data } = await (supabase as unknown as UntypedRpc).rpc(
    "get_public_season_groups",
    {
      p_organization_id: organizationId,
      p_season_slug: seasonSlug,
    }
  );
  const rows = (data ?? []) as Array<{
    group_id: string;
    group_name: string;
  }>;
  return rows.map((r) => ({ id: r.group_id, name: r.group_name }));
}
