export interface MemberBalance {
  memberId: string;
  balance: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

// Greedy debt simplification: repeatedly matches the largest debtor against
// the largest creditor until all net balances reach zero.
// Works at full float precision internally; only settlement amounts are rounded
// to 2dp for display. Sub-cent residuals (< 0.005) are treated as zero so
// float drift never causes an infinite loop.
export function simplifyDebts(members: MemberBalance[]): Settlement[] {
  const EPSILON = 0.005;

  // Mutable copies at full precision — filter members that are already settled
  const balances = members
    .map(({ memberId, balance }) => ({ memberId, balance }))
    .filter(({ balance }) => Math.abs(balance) >= EPSILON);

  const settlements: Settlement[] = [];

  // Sort descending: creditors (positive) at front, debtors (negative) at back
  balances.sort((a, b) => b.balance - a.balance);

  let hi = 0;                    // largest creditor pointer
  let lo = balances.length - 1; // largest debtor pointer

  while (hi < lo) {
    const creditor = balances[hi];
    const debtor = balances[lo];

    // Skip any entry that has drifted within epsilon of zero
    if (creditor.balance < EPSILON) { hi++; continue; }
    if (-debtor.balance < EPSILON) { lo--; continue; }

    // Round the settlement amount to 2dp for display, but carry the full
    // precision residual forward so future iterations can absorb it
    const exactAmount = Math.min(creditor.balance, -debtor.balance);
    const amount = round2(exactAmount);

    settlements.push({ from: debtor.memberId, to: creditor.memberId, amount });

    creditor.balance -= exactAmount;
    debtor.balance += exactAmount;

    if (Math.abs(creditor.balance) < EPSILON) hi++;
    if (Math.abs(debtor.balance) < EPSILON) lo--;
  }

  return settlements;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
