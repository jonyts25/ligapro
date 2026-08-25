type ChronicleJson = {
  cronica?: unknown;
};

function readCronicaFromParsed(parsed: ChronicleJson): string | null {
  if (typeof parsed.cronica === "string" && parsed.cronica.trim()) {
    return parsed.cronica.trim();
  }
  return null;
}

/**
 * Extrae el texto de crónica del JSON que pide buildChroniclePrompt.
 * Tolera texto extra alrededor del objeto JSON.
 */
export function parseChronicleResponse(raw: string): string {
  const trimmed = raw.trim();

  try {
    const cronica = readCronicaFromParsed(JSON.parse(trimmed) as ChronicleJson);
    if (cronica) return cronica;
  } catch {
    // Fall through to brace extraction.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const cronica = readCronicaFromParsed(
        JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as ChronicleJson
      );
      if (cronica) return cronica;
    } catch {
      // Fall through to error below.
    }
  }

  throw new Error(
    "La respuesta de la IA no contiene JSON válido con la clave «cronica»."
  );
}
