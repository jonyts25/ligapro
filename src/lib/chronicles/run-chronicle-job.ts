import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicModel } from "@/lib/ai/call-ai";
import { generarTextoIA } from "@/lib/ai/generar-texto-ia";
import { parseChronicleResponse } from "@/lib/chronicles/parse-chronicle-response";
import type { Database } from "@/types/database";

export type RunChronicleJobInput = {
  jobId: string;
  organizationId: string;
  matchId: string;
  prompt: string;
  tier?: "basico" | "premium";
};

type GenerateText = (prompt: string) => Promise<string>;

export async function runChronicleJob(
  supabase: SupabaseClient<Database>,
  input: RunChronicleJobInput,
  generate: GenerateText = generarTextoIA
): Promise<{ ok: true; content: string } | { ok: false; errorMessage: string }> {
  const tier = input.tier ?? "basico";
  const modelUsed = getAnthropicModel();
  const processedAt = new Date().toISOString();

  await supabase
    .from("ai_jobs")
    .update({ status: "processing" })
    .eq("id", input.jobId)
    .eq("organization_id", input.organizationId);

  try {
    const raw = await generate(input.prompt);
    const content = parseChronicleResponse(raw);

    const { error: chronicleError } = await supabase
      .from("match_chronicles")
      .upsert(
        {
          organization_id: input.organizationId,
          match_id: input.matchId,
          ai_job_id: input.jobId,
          tier,
          content,
          model_used: modelUsed,
          is_published: false,
          generated_at: processedAt,
        },
        { onConflict: "match_id" }
      );

    if (chronicleError) {
      throw new Error(chronicleError.message);
    }

    const { error: jobError } = await supabase
      .from("ai_jobs")
      .update({
        status: "done",
        resultado: { cronica: content },
        error_message: null,
        processed_at: processedAt,
      })
      .eq("id", input.jobId)
      .eq("organization_id", input.organizationId);

    if (jobError) {
      throw new Error(jobError.message);
    }

    return { ok: true, content };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Error desconocido al generar la crónica.";

    await supabase
      .from("ai_jobs")
      .update({
        status: "error",
        error_message: errorMessage,
        processed_at: processedAt,
      })
      .eq("id", input.jobId)
      .eq("organization_id", input.organizationId);

    return { ok: false, errorMessage };
  }
}
