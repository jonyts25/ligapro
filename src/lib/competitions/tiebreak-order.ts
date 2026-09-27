export const TIEBREAK_CRITERIA = [
  "goal_difference",
  "goals_for",
  "goals_against",
  "wins",
] as const;

export type TiebreakCriterion = (typeof TIEBREAK_CRITERIA)[number];

export const DEFAULT_TIEBREAK_ORDER: TiebreakCriterion[] = [
  "goal_difference",
  "goals_for",
  "goals_against",
  "wins",
];

export const TIEBREAK_LABELS: Record<TiebreakCriterion, string> = {
  goal_difference: "Diferencia de goles",
  goals_for: "Goles a favor",
  goals_against: "Goles en contra",
  wins: "Partidos ganados",
};

const CRITERION_SET = new Set<string>(TIEBREAK_CRITERIA);

export function isTiebreakCriterion(value: string): value is TiebreakCriterion {
  return CRITERION_SET.has(value);
}

export function validateTiebreakOrder(
  order: readonly string[]
): { ok: true; value: TiebreakCriterion[] } | { ok: false; error: string } {
  if (order.length !== TIEBREAK_CRITERIA.length) {
    return {
      ok: false,
      error: "Debes incluir los cuatro criterios de desempate.",
    };
  }

  const seen = new Set<string>();
  for (const item of order) {
    if (!isTiebreakCriterion(item)) {
      return { ok: false, error: "Hay un criterio de desempate inválido." };
    }
    if (seen.has(item)) {
      return { ok: false, error: "Cada criterio solo puede aparecer una vez." };
    }
    seen.add(item);
  }

  return { ok: true, value: [...order] as TiebreakCriterion[] };
}

export function parseTiebreakOrderInput(raw: string): ReturnType<
  typeof validateTiebreakOrder
> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return validateTiebreakOrder(DEFAULT_TIEBREAK_ORDER);
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: false, error: "Formato de desempate inválido." };
    }
    return validateTiebreakOrder(parsed.map(String));
  } catch {
    return { ok: false, error: "Formato de desempate inválido." };
  }
}

export function normalizeTiebreakOrder(
  order: readonly string[] | null | undefined
): TiebreakCriterion[] {
  const result = validateTiebreakOrder(order ?? DEFAULT_TIEBREAK_ORDER);
  return result.ok ? result.value : DEFAULT_TIEBREAK_ORDER;
}

export function moveTiebreakItem(
  order: readonly TiebreakCriterion[],
  index: number,
  direction: "up" | "down"
): TiebreakCriterion[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) {
    return [...order];
  }
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
