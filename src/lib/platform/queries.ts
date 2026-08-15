import { createClient } from "@/lib/supabase/server";

export type RecentPublishedSeason = {
  seasonId: string;
  seasonName: string;
  organizationId: string;
  organizationName: string;
  competitionId: string;
  competitionName: string;
  updatedAt: string;
  publicUrl: string;
};

export async function getRecentlyPublishedSeasons(
  limit = 15
): Promise<RecentPublishedSeason[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("seasons")
    .select(
      "id, name, slug, updated_at, organization_id, competition_id, organizations(name), competitions(name)"
    )
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const orgRel = row.organizations as
      | { name: string }
      | { name: string }[]
      | null;
    const compRel = row.competitions as
      | { name: string }
      | { name: string }[]
      | null;
    const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;
    const comp = Array.isArray(compRel) ? compRel[0] : compRel;

    return {
      seasonId: row.id,
      seasonName: row.name,
      organizationId: row.organization_id,
      organizationName: org?.name ?? "Organización",
      competitionId: row.competition_id,
      competitionName: comp?.name ?? "Torneo",
      updatedAt: row.updated_at,
      publicUrl: `/publico/${row.organization_id}/${row.slug}`,
    };
  });
}
