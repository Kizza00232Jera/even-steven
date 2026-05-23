export interface Split {
  memberId: string;
  share: number;
  baseShare?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100) / 100;

/**
 * Equal split: all non-payer shares rounded down to 2dp; payer absorbs the remainder.
 */
export function calculateEqualSplit(
  totalAmount: number,
  participantIds: string[],
  payerId: string
): Split[] {
  const n = participantIds.length;
  const baseShare = floor2(totalAmount / n);
  const nonPayerCount = participantIds.filter((id) => id !== payerId).length;
  const othersTotal = round2(baseShare * nonPayerCount);
  const payerShare = round2(totalAmount - othersTotal);

  return participantIds.map((memberId) => ({
    memberId,
    share: memberId === payerId ? payerShare : baseShare,
  }));
}

/**
 * Unequal split: payer's share is the remainder after all other amounts.
 * Pass 0 for the payer's amount — it is always overridden by the remainder.
 * Throws if any non-payer amount is negative or if the computed payer share is negative.
 */
export function calculateUnequalSplit(
  totalAmount: number,
  participantShares: { memberId: string; amount: number }[],
  payerId: string
): Split[] {
  for (const { memberId, amount } of participantShares) {
    if (memberId !== payerId && amount < 0) {
      throw new Error(`Negative share for member ${memberId}`);
    }
  }

  const othersTotal = participantShares
    .filter(({ memberId }) => memberId !== payerId)
    .reduce((acc, { amount }) => round2(acc + amount), 0);

  const payerShare = round2(totalAmount - othersTotal);

  if (payerShare < 0) {
    throw new Error("Other members' shares exceed the total amount");
  }

  return participantShares.map(({ memberId, amount }) => ({
    memberId,
    share: memberId === payerId ? payerShare : amount,
  }));
}

/**
 * Percentage split: converts percentages to currency amounts.
 * Payer's percentage is the remainder of 100 minus others' percentages.
 * Pass 0 for the payer's percentage — it is always overridden by the remainder.
 * Throws if any non-payer percentage is negative or if total exceeds 100.
 */
export function calculatePercentageSplit(
  totalAmount: number,
  participantPercentages: { memberId: string; percentage: number }[],
  payerId: string
): Split[] {
  for (const { memberId, percentage } of participantPercentages) {
    if (memberId !== payerId && percentage < 0) {
      throw new Error(`Negative percentage for member ${memberId}`);
    }
  }

  const othersTotal = participantPercentages
    .filter(({ memberId }) => memberId !== payerId)
    .reduce((acc, { percentage }) => round2(acc + percentage), 0);

  if (othersTotal > 100) {
    throw new Error("Percentages exceed 100%");
  }

  const payerPercentage = round2(100 - othersTotal);

  return participantPercentages.map(({ memberId, percentage }) => {
    const pct = memberId === payerId ? payerPercentage : percentage;
    return { memberId, share: round2((pct / 100) * totalAmount) };
  });
}
