type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
};

export function classifySyncError(error: unknown): {
  kind: "network" | "business";
  message: string;
} {
  if (error instanceof TypeError) {
    return { kind: "network", message: error.message || "Sin conexión" };
  }

  const err = error as SupabaseLikeError;
  const message = err.message?.trim() || "Error desconocido";

  const lower = message.toLowerCase();
  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("timeout") ||
    err.code === "ECONNABORTED"
  ) {
    return { kind: "network", message };
  }

  return { kind: "business", message };
}
