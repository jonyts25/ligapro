import { callAI } from "@/lib/ai/call-ai";

const CHRONICLE_SYSTEM_PROMPT =
  "Sigues instrucciones exactamente y respondes solo con el JSON pedido, sin texto adicional.";

/**
 * Punto único de swap de proveedor de generación de texto (ADR-0016 §3.4).
 *
 * Invoca Anthropic Messages API vía `callAI`. Los llamadores esperan el texto
 * crudo del modelo (JSON con clave `cronica` para crónicas de partido).
 */
export async function generarTextoIA(prompt: string): Promise<string> {
  const { text, error } = await callAI(CHRONICLE_SYSTEM_PROMPT, prompt);
  if (error) {
    throw new Error(error);
  }
  if (!text) {
    throw new Error("Anthropic API respondió sin contenido de texto.");
  }
  return text;
}
