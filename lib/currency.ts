export type Currency = "USD" | "EUR" | "DKK" | "SEK";

const THOUSANDS_SEP = " "; // regular space — not non-breaking space

// §39: period decimal sep, space thousands sep, symbol prefix (USD/EUR), code suffix (DKK/SEK)
export function format(amount: number, currency: Currency): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);

  const [intPart, decPart] = abs.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);
  const numeric = `${grouped}.${decPart}`;

  let result: string;
  if (currency === "USD") {
    result = `$${numeric}`;
  } else if (currency === "EUR") {
    result = `€${numeric}`;
  } else {
    result = `${numeric} ${currency}`;
  }

  return negative ? `-${result}` : result;
}

// Rates object is keyed by currency code with values relative to a common base (e.g. USD=1).
// Caller is responsible for fetching and passing rates — no side effects here.
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
