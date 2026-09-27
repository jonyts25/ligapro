const MATCH_OFFICIAL_ROLE_LABELS: Record<string, string> = {
  referee: "Árbitro",
  delegate: "Delegado",
  assistant: "Asistente",
  scorekeeper: "Anotador",
};

const MATCH_OFFICIAL_STATUS_LABELS: Record<string, string> = {
  assigned: "Asignado",
  confirmed: "Confirmado",
  declined: "Rechazado",
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  in_progress: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
  walkover: "Walkover",
};

export function matchOfficialRoleLabel(role: string): string {
  return MATCH_OFFICIAL_ROLE_LABELS[role] ?? role;
}

export function matchOfficialStatusLabel(status: string): string {
  return MATCH_OFFICIAL_STATUS_LABELS[status] ?? status;
}

export function matchStatusLabel(status: string): string {
  return MATCH_STATUS_LABELS[status] ?? status;
}
