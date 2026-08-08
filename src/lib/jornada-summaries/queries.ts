import { createClient } from "@/lib/supabase/server";
import type {
  JornadaSummaryJobRow,
  JornadaSummaryRow,
} from "@/lib/jornada-summaries/types";

type SummaryDbRow = {
  id: string;
  season_id: string;
  round_number: number;
  content: string;
  is_published: boolean;
  model_used: string | null;
  created_at: string;
  updated_at: string;
};

type JobDbRow = {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
};

export async function getJornadaSummary(
  organizationId: string,
  seasonId: string,
  roundNumber: number
): Promise<JornadaSummaryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jornada_summaries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("season_id", seasonId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as SummaryDbRow;
  return {
    id: row.id,
    seasonId: row.season_id,
    roundNumber: row.round_number,
    content: row.content,
    isPublished: row.is_published,
    modelUsed: row.model_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLatestJornadaSummaryJob(
  organizationId: string,
  seasonId: string,
  roundNumber: number
): Promise<JornadaSummaryJobRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_jobs")
    .select("id, status, error_message, created_at, processed_at, payload")
    .eq("organization_id", organizationId)
    .eq("tipo", "jornada_resumen")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return null;

  const match = (data as Array<JobDbRow & { payload: { season_id?: string; round_number?: number } }>).find(
    (job) =>
      job.payload?.season_id === seasonId &&
      job.payload?.round_number === roundNumber
  );

  if (!match) return null;

  return {
    id: match.id,
    status: match.status,
    errorMessage: match.error_message,
    createdAt: match.created_at,
    processedAt: match.processed_at,
  };
}
