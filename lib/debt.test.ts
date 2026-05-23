import { simplifyDebts } from "./debt";

function applySettlements(
  balances: { memberId: string; balance: number }[],
  settlements: { from: string; to: string; amount: number }[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const { memberId, balance } of balances) {
    result[memberId] = balance;
  }
  for (const { from, to, amount } of settlements) {
    result[from] = (result[from] ?? 0) + amount;  // debtor pays: balance rises toward 0
    result[to] = (result[to] ?? 0) - amount;       // creditor receives: balance falls toward 0
  }
  return result;
}

function allZero(net: Record<string, number>): boolean {
  return Object.values(net).every((v) => Math.abs(v) < 0.005);
}

describe("simplifyDebts", () => {
  it("returns empty array for an already-balanced group", () => {
    const result = simplifyDebts([
      { memberId: "a", balance: 0 },
      { memberId: "b", balance: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it("returns empty array for an empty member list", () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it("ignores zero-balance members and produces no settlement for them", () => {
    const result = simplifyDebts([
      { memberId: "a", balance: 10 },
      { memberId: "b", balance: -10 },
      { memberId: "c", balance: 0 },
    ]);
    expect(result.some((s) => s.from === "c" || s.to === "c")).toBe(false);
  });

  it("resolves a simple two-person debt in one settlement", () => {
    const balances = [
      { memberId: "a", balance: 10 },
      { memberId: "b", balance: -10 },
    ];
    const settlements = simplifyDebts(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "b", to: "a", amount: 10 });
    expect(allZero(applySettlements(balances, settlements))).toBe(true);
  });

  it("zeroes all balances after applying settlements (chain case)", () => {
    // A paid for B and C equally; raw pairwise would be 2 payments, greedy should still be 2
    const balances = [
      { memberId: "a", balance: 20 },
      { memberId: "b", balance: -10 },
      { memberId: "c", balance: -10 },
    ];
    const settlements = simplifyDebts(balances);
    expect(allZero(applySettlements(balances, settlements))).toBe(true);
    // Minimum possible here is 2 settlements
    expect(settlements.length).toBeLessThanOrEqual(2);
  });

  it("produces minimal settlements for a classic triangle case", () => {
    // A owes B 10, B owes C 10, C owes A 10 — all cancel, net balances are zero
    const balances = [
      { memberId: "a", balance: 0 },
      { memberId: "b", balance: 0 },
      { memberId: "c", balance: 0 },
    ];
    const settlements = simplifyDebts(balances);
    expect(settlements).toEqual([]);
  });

  it("produces fewer settlements than raw pairwise (greedy optimisation)", () => {
    // 4-person case where greedy produces 3 settlements instead of 4+ pairwise
    // A: +30, B: -10, C: -10, D: -10
    const balances = [
      { memberId: "a", balance: 30 },
      { memberId: "b", balance: -10 },
      { memberId: "c", balance: -10 },
      { memberId: "d", balance: -10 },
    ];
    const settlements = simplifyDebts(balances);
    expect(settlements.length).toBe(3);
    expect(allZero(applySettlements(balances, settlements))).toBe(true);
  });

  it("handles asymmetric balances where creditor partially absorbs debtor", () => {
    // A: +30, B: -20, C: -10
    const balances = [
      { memberId: "a", balance: 30 },
      { memberId: "b", balance: -20 },
      { memberId: "c", balance: -10 },
    ];
    const settlements = simplifyDebts(balances);
    expect(settlements.length).toBe(2);
    expect(allZero(applySettlements(balances, settlements))).toBe(true);
  });

  it("handles multiple creditors and debtors", () => {
    // A: +50, B: +20, C: -40, D: -30
    const balances = [
      { memberId: "a", balance: 50 },
      { memberId: "b", balance: 20 },
      { memberId: "c", balance: -40 },
      { memberId: "d", balance: -30 },
    ];
    const settlements = simplifyDebts(balances);
    expect(allZero(applySettlements(balances, settlements))).toBe(true);
    // Optimal is 3 settlements (n-1 for n distinct net positions)
    expect(settlements.length).toBeLessThanOrEqual(3);
  });

  it("handles sub-cent float amounts without infinite loops", () => {
    // Realistic 3-way equal split of $10: spec says payer absorbs remainder,
    // so DB stores clean 2dp values: payer nets +6.66, others owe -3.33 each
    const balances = [
      { memberId: "a", balance: 6.66 },
      { memberId: "b", balance: -3.33 },
      { memberId: "c", balance: -3.33 },
    ];
    const settlements = simplifyDebts(balances);
    expect(allZero(applySettlements(balances, settlements))).toBe(true);
    expect(settlements.length).toBeLessThanOrEqual(2);
  });

  it("terminates without infinite loops when balances have float drift near zero", () => {
    // Sub-cent drift (< 0.005) should be ignored, not cause looping
    const balances = [
      { memberId: "a", balance: 0.001 },   // below epsilon, should be ignored
      { memberId: "b", balance: -0.001 },  // below epsilon, should be ignored
    ];
    const settlements = simplifyDebts(balances);
    expect(settlements).toEqual([]);
  });

  it("rounds settlement amounts to 2 decimal places", () => {
    const balances = [
      { memberId: "a", balance: 10 / 3 },
      { memberId: "b", balance: -(10 / 3) },
    ];
    const settlements = simplifyDebts(balances);
    if (settlements.length > 0) {
      const decimals = settlements[0].amount.toString().split(".")[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    }
  });

  it("amounts in settlements are always positive", () => {
    const balances = [
      { memberId: "a", balance: 15 },
      { memberId: "b", balance: -15 },
    ];
    const settlements = simplifyDebts(balances);
    for (const s of settlements) {
      expect(s.amount).toBeGreaterThan(0);
    }
  });

  it("from is always the debtor and to is always the creditor", () => {
    const balances = [
      { memberId: "creditor", balance: 25 },
      { memberId: "debtor", balance: -25 },
    ];
    const settlements = simplifyDebts(balances);
    expect(settlements[0].from).toBe("debtor");
    expect(settlements[0].to).toBe("creditor");
  });
});
