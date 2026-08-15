/**
 * Punto único de swap de proveedor de generación de texto (ADR-0016 §3.4).
 *
 * Hoy la app encola trabajos en `ai_jobs` y un worker local (Ollama/qwen3)
 * procesa de forma asíncrona — este módulo documenta el contrato para una
 * invocación síncrona futura.
 *
 * Para migrar a Anthropic: sustituir SOLO el cuerpo de `generarTextoIA`
 * por una llamada HTTP al endpoint Messages — sin tocar prompt builders,
 * gates `is_published`, ni el pipeline de encolado existente.
 */
export async function generarTextoIA(prompt: string): Promise<string> {
  void prompt;
  throw new Error(
    "generarTextoIA: la generación síncrona no está activa. " +
      "Usar cola ai_jobs + worker local (Ollama). " +
      "Para Anthropic, implementar fetch() aquí."
  );
}
