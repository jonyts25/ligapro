import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getPublicSeasonYouthFlag = cache(
  async (organizationId: string, seasonSlug: string): Promise<boolean> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("seasons")
      .select("competitions(is_youth)")
      .eq("organization_id", organizationId)
      .eq("slug", seasonSlug)
      .eq("visibility", "public")
      .maybeSingle();

    const competitionRel = data?.competitions as
      | { is_youth: boolean }
      | { is_youth: boolean }[]
      | null;
    const competition = Array.isArray(competitionRel)
      ? competitionRel[0]
      : competitionRel;

    return competition?.is_youth ?? false;
  }
);
