/**
 * Provider-agnostic text generation interface.
 *
 * Current implementation: local Ollama worker via ai_jobs queue + polling
 * (same pattern as match chronicles — worker writes results asynchronously).
 *
 * Future swap to Anthropic Messages API: replace the body of this function
 * with an HTTP POST to https://api.anthropic.com/v1/messages — do NOT change
 * prompt builders, publication gates, or callers.
 */
export async function generarTextoIA(_prompt: string): Promise<string> {
  throw new Error(
    "generarTextoIA is invoked by the local worker after enqueue; not for direct synchronous calls from the app server."
  );
}
