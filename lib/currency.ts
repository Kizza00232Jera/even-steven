export type Currency = "USD" | "EUR" | "DKK" | "SEK";

const THOUSANDS_SEP = " "; // regular space — not non-breaking space

// §39
export function format(amount: number, currency: Currency): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);

  const [intPart, decPart] = abs.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);
  const numeric = `${grouped}.${decPart}`;
  const sign = negative ? "-" : "";

  if (currency === "USD") return `${sign}$${numeric}`;
  if (currency === "EUR") return `${sign}€${numeric}`;
  return `${sign}${numeric} ${currency}`;
}

// Rates are keyed by currency code, values relative to a common base (e.g. USD=1).
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Record<string, number>
): number {
  if (rates[from] === undefined) {
    throw new Error(`Missing exchange rate for ${from}`);
  }
  if (rates[to] === undefined) {
    throw new Error(`Missing exchange rate for ${to}`);
  }
  return (amount / rates[from]) * rates[to];
}
