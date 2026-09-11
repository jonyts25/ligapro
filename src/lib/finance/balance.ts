export type TeamBalance = {
  totalCharges: number;
  totalPaid: number;
  balanceDue: number;
  hasCredit: boolean;
  creditAmount: number;
};

export function computeTeamBalance(
  totalCharges: number,
  totalPaid: number
): TeamBalance {
  const balanceDue = totalCharges - totalPaid;
  const hasCredit = balanceDue < 0;

  return {
    totalCharges,
    totalPaid,
    balanceDue,
    hasCredit,
    creditAmount: hasCredit ? Math.abs(balanceDue) : 0,
  };
}

export function buildOverpaymentWarning(
  balance: TeamBalance,
  paymentAmount: number
): string | null {
  if (paymentAmount <= balance.balanceDue) {
    return null;
  }

  const projectedBalance = balance.balanceDue - paymentAmount;
  if (projectedBalance >= 0) {
    return null;
  }

  return `Este pago deja un saldo a favor de ${Math.abs(projectedBalance).toFixed(2)} MXN.`;
}

export function summarizeSeasonFinanceTotals(
  teams: Array<{ totalCharges: number; totalPayments: number; balanceDue: number }>
): {
  totalCharges: number;
  totalCollected: number;
  totalPending: number;
  totalCredit: number;
} {
  let totalCharges = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let totalCredit = 0;

  for (const team of teams) {
    totalCharges += team.totalCharges;
    totalCollected += team.totalPayments;
    if (team.balanceDue > 0) {
      totalPending += team.balanceDue;
    } else if (team.balanceDue < 0) {
      totalCredit += Math.abs(team.balanceDue);
    }
  }

  return { totalCharges, totalCollected, totalPending, totalCredit };
}
