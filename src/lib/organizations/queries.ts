import { createClient } from "@/lib/supabase/server";
import type { OrganizationSeasonOption } from "@/lib/organizations/season-picker";

export async function listOrganizationSeasonOptions(
  organizationId: string
): Promise<OrganizationSeasonOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, created_at, starts_on, competition_id, competitions(name)")
    .eq("organization_id", organizationId)
    .neq("visibility", "archived")
    .order("created_at", { ascending: false });

  return (data ?? []).map((season) => {
    const competitionRel = season.competitions as
      | { name: string }
      | { name: string }[]
      | null;
    const competition = Array.isArray(competitionRel)
      ? competitionRel[0]
      : competitionRel;

    return {
      seasonId: season.id,
      competitionId: season.competition_id,
      label: season.name,
      competitionName: competition?.name ?? "Torneo",
      createdAt: season.created_at,
      startsOn: season.starts_on,
    };
  });
}
