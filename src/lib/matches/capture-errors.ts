export type CaptureErrorKind =
  | "capture_window_closed"
  | "not_authorized"
  | "match_closed"
  | "already_voided"
  | "generic";

export function humanizeCaptureError(message: string): {
  message: string;
  kind: CaptureErrorKind;
} {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes("ventana de captura")) {
    return {
      message: "La ventana de captura para este partido ya cerró",
      kind: "capture_window_closed",
    };
  }
  if (lower.includes("not authorized") || lower.includes("row-level")) {
    return {
      message: "No tienes permiso para esta acción.",
      kind: "not_authorized",
    };
  }
  if (
    lower.includes("partido cerrado") ||
    lower.includes("closed match") ||
    lower.includes("finished") ||
    lower.includes("cancelled") ||
    lower.includes("walkover")
  ) {
    return {
      message: trimmed || "No se pueden registrar eventos en un partido cerrado.",
      kind: "match_closed",
    };
  }
  if (lower.includes("organization_members")) {
    return {
      message: "El usuario debe ser miembro vigente de la organización.",
      kind: "not_authorized",
    };
  }
  if (lower.includes("void reason is required")) {
    return {
      message: "El motivo de anulación es obligatorio.",
      kind: "generic",
    };
  }
  if (lower.includes("already voided")) {
    return {
      message: "Este evento ya estaba anulado.",
      kind: "already_voided",
    };
  }
  if (lower.includes("unique") || lower.includes("duplicate")) {
    return { message: "Esa asignación ya existe.", kind: "generic" };
  }

  return { message: trimmed || "No se pudo completar la operación.", kind: "generic" };
}

export function captureErrorAlertClass(kind: CaptureErrorKind): string {
  switch (kind) {
    case "capture_window_closed":
      return "border-warning/40 bg-warning/10 text-warning";
    case "not_authorized":
    case "already_voided":
      return "border-danger/40 bg-danger/10 text-danger";
    default:
      return "border-danger/40 bg-danger/10 text-danger";
  }
}
