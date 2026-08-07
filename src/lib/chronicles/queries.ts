import { createClient } from "@/lib/supabase/server";
import type {
  MatchChronicleJobRow,
  MatchChronicleRow,
} from "@/lib/chronicles/types";

type AiJobPayload = {
  match_id?: string;
};

export async function getMatchChronicle(
  organizationId: string,
  matchId: string
): Promise<MatchChronicleRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_chronicles")
    .select(
      "id, match_id, content, tier, is_published, generated_at, model_used"
    )
    .eq("organization_id", organizationId)
    .eq("match_id", matchId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    matchId: data.match_id,
    content: data.content,
    tier: data.tier,
    isPublished: data.is_published,
    generatedAt: data.generated_at,
    modelUsed: data.model_used,
  };
}

export async function getLatestChronicleJobForMatch(
  organizationId: string,
  matchId: string
): Promise<MatchChronicleJobRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_jobs")
    .select("id, status, error_message, created_at, processed_at, payload")
    .eq("organization_id", organizationId)
    .eq("tipo", "cronica")
    .order("created_at", { ascending: false })
    .limit(25);

  const row = (data ?? []).find((job) => {
    const payload = job.payload as AiJobPayload;
    return payload.match_id === matchId;
  });

  if (!row) return null;

  return {
    id: row.id,
    status: row.status as MatchChronicleJobRow["status"],
    errorMessage: row.error_message,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  };
}
