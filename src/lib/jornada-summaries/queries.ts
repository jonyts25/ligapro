import { createClient } from "@/lib/supabase/server";
import {
  jornadaRoundLabel,
  parseJornadaContent,
  type JornadaSummaryRecord,
} from "@/lib/jornada-summaries/types";

type SummaryRow = {
  id: string;
  season_id: string;
  round_label: string;
  content: unknown;
  is_published: boolean;
  updated_at: string;
};

function mapRow(row: SummaryRow): JornadaSummaryRecord {
  return {
    id: row.id,
    seasonId: row.season_id,
    roundLabel: row.round_label,
    content: parseJornadaContent(row.content),
    isPublished: row.is_published,
    updatedAt: row.updated_at,
  };
}

export async function getJornadaSummary(
  organizationId: string,
  seasonId: string,
  roundLabel: string
): Promise<JornadaSummaryRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jornada_summaries")
    .select("id, season_id, round_label, content, is_published, updated_at")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("round_label", roundLabel)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data as SummaryRow);
}

export async function getJornadaSummariesForSeason(
  organizationId: string,
  seasonId: string
): Promise<Map<string, JornadaSummaryRecord>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jornada_summaries")
    .select("id, season_id, round_label, content, is_published, updated_at")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId);

  const map = new Map<string, JornadaSummaryRecord>();
  for (const row of (data ?? []) as SummaryRow[]) {
    map.set(row.round_label, mapRow(row));
  }
  return map;
}

export async function getLatestJornadaSummaryJob(
  organizationId: string,
  seasonId: string,
  roundLabel: string
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_jobs")
    .select("id, status, error_message, created_at, processed_at")
    .eq("organization_id", organizationId)
    .eq("tipo", "resumen_jornada")
    .contains("payload", { season_id: seasonId, round_label: roundLabel })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export { jornadaRoundLabel };
