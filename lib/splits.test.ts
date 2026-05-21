import { describe, it, expect } from "vitest";
import {
  calculateEqualSplit,
  calculateUnequalSplit,
  calculatePercentageSplit,
} from "./splits";

// ─── Helpers ────────────────────────────────────────────────────────────────

const sum = (shares: { memberId: string; share: number }[]) =>
  shares.reduce((acc, s) => acc + s.share, 0);

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Equal split ────────────────────────────────────────────────────────────

describe("calculateEqualSplit", () => {
  it("divides evenly when no remainder", () => {
    const result = calculateEqualSplit(30, ["a", "b", "c"], "a");
    expect(result).toEqual([
      { memberId: "a", share: 10 },
      { memberId: "b", share: 10 },
      { memberId: "c", share: 10 },
    ]);
  });

  it("rounds individual shares down and payer absorbs remainder", () => {
    // 10 / 3 = 3.333… → floor to 3.33, payer absorbs 0.01
    const result = calculateEqualSplit(10, ["a", "b", "c"], "a");
    const payer = result.find((s) => s.memberId === "a")!;
    const others = result.filter((s) => s.memberId !== "a");

    // others are floored
    others.forEach((s) => expect(s.share).toBe(3.33));
    // total sums exactly to totalAmount
    expect(round2(sum(result))).toBe(10);
    // payer absorbed the extra
    expect(payer.share).toBeGreaterThan(3.33);
  });

  it("works with two participants", () => {
    const result = calculateEqualSplit(7, ["a", "b"], "a");
    // 7 / 2 = 3.50 each — no remainder
    expect(sum(result)).toBeCloseTo(7, 10);
  });

  it("returns one entry per participant", () => {
    const result = calculateEqualSplit(100, ["a", "b", "c", "d"], "a");
    expect(result).toHaveLength(4);
  });

  it("works with single participant (payer pays all)", () => {
    const result = calculateEqualSplit(50, ["a"], "a");
    expect(result).toEqual([{ memberId: "a", share: 50 }]);
  });
});

// ─── Unequal split ───────────────────────────────────────────────────────────

describe("calculateUnequalSplit", () => {
  it("payer holds full amount when no other amounts entered", () => {
    const result = calculateUnequalSplit(
      100,
      [
        { memberId: "a", amount: 0 },
        { memberId: "b", amount: 0 },
        { memberId: "c", amount: 0 },
      ],
      "a"
    );
    const payer = result.find((s) => s.memberId === "a")!;
    expect(payer.share).toBe(100);
  });

  it("payer remainder decreases as others get amounts", () => {
    const result = calculateUnequalSplit(
      100,
      [
        { memberId: "a", amount: 0 },
        { memberId: "b", amount: 30 },
        { memberId: "c", amount: 40 },
      ],
      "a"
    );
    const payer = result.find((s) => s.memberId === "a")!;
    expect(payer.share).toBe(30);
    expect(round2(sum(result))).toBe(100);
  });

  it("payer's input amount is ignored; share is always computed as remainder", () => {
    const result = calculateUnequalSplit(
      90,
      [
        { memberId: "a", amount: 30 },
        { memberId: "b", amount: 30 },
        { memberId: "c", amount: 30 },
      ],
      "a"
    );
    expect(round2(sum(result))).toBe(90);
    result.forEach((s) => expect(s.share).toBe(30));
  });

  it("throws when a non-payer share is negative", () => {
    expect(() =>
      calculateUnequalSplit(
        100,
        [
          { memberId: "a", amount: 0 },
          { memberId: "b", amount: -10 },
        ],
        "a"
      )
    ).toThrow();
  });

  it("throws when payer share would be negative (others exceed total)", () => {
    expect(() =>
      calculateUnequalSplit(
        100,
        [
          { memberId: "a", amount: 0 },
          { memberId: "b", amount: 60 },
          { memberId: "c", amount: 60 },
        ],
        "a"
      )
    ).toThrow();
  });

  it("returns correct memberId-to-share mapping", () => {
    const result = calculateUnequalSplit(
      200,
      [
        { memberId: "x", amount: 0 },
        { memberId: "y", amount: 80 },
      ],
      "x"
    );
    expect(result.find((s) => s.memberId === "y")!.share).toBe(80);
    expect(result.find((s) => s.memberId === "x")!.share).toBe(120);
  });
});

// ─── Percentage split ────────────────────────────────────────────────────────

describe("calculatePercentageSplit", () => {
  it("payer holds 100% when no percentages assigned to others", () => {
    const result = calculatePercentageSplit(
      200,
      [
        { memberId: "a", percentage: 0 },
        { memberId: "b", percentage: 0 },
      ],
      "a"
    );
    const payer = result.find((s) => s.memberId === "a")!;
    expect(payer.share).toBe(200);
    expect(result.find((s) => s.memberId === "b")!.share).toBe(0);
  });

  it("converts percentages to currency amounts correctly", () => {
    const result = calculatePercentageSplit(
      200,
      [
        { memberId: "a", percentage: 0 },
        { memberId: "b", percentage: 25 },
        { memberId: "c", percentage: 25 },
      ],
      "a"
    );
    expect(result.find((s) => s.memberId === "b")!.share).toBe(50);
    expect(result.find((s) => s.memberId === "c")!.share).toBe(50);
    expect(result.find((s) => s.memberId === "a")!.share).toBe(100);
    expect(round2(sum(result))).toBe(200);
  });

  it("percentages sum to 100 with payer holding remainder", () => {
    const result = calculatePercentageSplit(
      100,
      [
        { memberId: "a", percentage: 0 },
        { memberId: "b", percentage: 40 },
        { memberId: "c", percentage: 35 },
      ],
      "a"
    );
    const payerPct = 100 - 40 - 35; // 25
    expect(result.find((s) => s.memberId === "a")!.share).toBe(25);
    expect(round2(sum(result))).toBe(100);
  });

  it("throws when any percentage is negative", () => {
    expect(() =>
      calculatePercentageSplit(
        100,
        [
          { memberId: "a", percentage: 0 },
          { memberId: "b", percentage: -10 },
        ],
        "a"
      )
    ).toThrow();
  });

  it("throws when non-payer percentages exceed 100", () => {
    expect(() =>
      calculatePercentageSplit(
        100,
        [
          { memberId: "a", percentage: 0 },
          { memberId: "b", percentage: 60 },
          { memberId: "c", percentage: 60 },
        ],
        "a"
      )
    ).toThrow();
  });

  it("handles fractional percentages rounding correctly", () => {
    // 1/3 each ≈ 33.33%
    const result = calculatePercentageSplit(
      100,
      [
        { memberId: "a", percentage: 0 },
        { memberId: "b", percentage: 33.33 },
        { memberId: "c", percentage: 33.33 },
      ],
      "a"
    );
    const bShare = result.find((s) => s.memberId === "b")!.share;
    const cShare = result.find((s) => s.memberId === "c")!.share;
    expect(bShare).toBeCloseTo(33.33, 1);
    expect(cShare).toBeCloseTo(33.33, 1);
    expect(round2(sum(result))).toBe(100);
  });

  it("payer explicitly assigns their own percentage", () => {
    const result = calculatePercentageSplit(
      300,
      [
        { memberId: "a", percentage: 50 },
        { memberId: "b", percentage: 25 },
        { memberId: "c", percentage: 25 },
      ],
      "a"
    );
    expect(result.find((s) => s.memberId === "a")!.share).toBe(150);
    expect(round2(sum(result))).toBe(300);
  });
});

// ─── Mode switching (pure function contract) ─────────────────────────────────

describe("mode switching behaviour", () => {
  it("equal split output is independent of any prior state (pure function)", () => {
    // Simulate: user had unequal split with specific amounts, switches to equal
    const unequalResult = calculateUnequalSplit(
      100,
      [
        { memberId: "a", amount: 0 },
        { memberId: "b", amount: 70 },
      ],
      "a"
    );
    // After mode switch, call equal — result must be fresh
    const equalResult = calculateEqualSplit(100, ["a", "b"], "a");
    expect(equalResult.find((s) => s.memberId === "b")!.share).toBe(50);
  });
});
