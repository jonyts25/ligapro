export const SUSPENSION_TYPE_OPTIONS = [
  { value: "administrative", label: "Administrativa" },
  { value: "expulsion", label: "Expulsión" },
] as const;

export type AdministrativeSuspensionType =
  (typeof SUSPENSION_TYPE_OPTIONS)[number]["value"];

export type ActiveSuspensionRow = {
  id: string;
  seasonTeamPlayerId: string;
  playerName: string;
  teamName: string;
  suspensionType: string;
  matchesRemaining: number;
  matchesServed: number;
  status: string;
  notes: string | null;
};

export type RosterPlayerOption = {
  seasonTeamPlayerId: string;
  playerName: string;
  teamName: string;
};

export type DisciplineActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | number | null>;
};

export const initialDisciplineActionState: DisciplineActionState = {
  ok: false,
  message: null,
};

export function suspensionTypeLabel(value: string): string {
  if (value === "direct_red") return "Roja directa";
  if (value === "accumulation") return "Acumulación";
  if (value === "administrative") return "Administrativa";
  if (value === "expulsion") return "Expulsión";
  return value;
}
