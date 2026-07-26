export const CHARGE_TYPE_OPTIONS = [
  { value: "registration", label: "Inscripción" },
  { value: "referee_fee", label: "Arbitraje" },
  { value: "fine", label: "Multa" },
  { value: "other", label: "Otro" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
] as const;

export type ChargeType = (typeof CHARGE_TYPE_OPTIONS)[number]["value"];
export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];

export type FinanceTeamStatus = "pagado" | "pendiente" | "sin_cargos";

export type FinanceChargeRow = {
  id: string;
  seasonTeamId: string;
  chargeType: string;
  description: string | null;
  amount: number;
  dueDate: string | null;
  createdAt: string;
};

export type FinancePaymentRow = {
  id: string;
  seasonTeamId: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  createdAt: string;
};

export type SeasonFinanceTeamRow = {
  seasonTeamId: string;
  teamName: string;
  registrationStatus: string;
  totalCharges: number;
  totalPayments: number;
  balanceDue: number;
  nextDueDate: string | null;
  status: FinanceTeamStatus;
  charges: FinanceChargeRow[];
  payments: FinancePaymentRow[];
};

export type FinanceActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | string[] | null>;
};

export const initialFinanceActionState: FinanceActionState = {
  ok: false,
  message: null,
};

export function chargeTypeLabel(value: string): string {
  return CHARGE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function paymentMethodLabel(value: string): string {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function financeTeamStatusLabel(status: FinanceTeamStatus): string {
  if (status === "pagado") return "Pagado";
  if (status === "pendiente") return "Pendiente";
  return "Sin cargos";
}

export function deriveFinanceTeamStatus(
  totalCharges: number,
  balanceDue: number
): FinanceTeamStatus {
  if (totalCharges <= 0) return "sin_cargos";
  if (balanceDue <= 0) return "pagado";
  return "pendiente";
}
