import { format, convert } from "./currency";

// §39 — fixed format: period decimal sep, space thousands sep, symbol prefix (USD/EUR), code suffix (DKK/SEK)

describe("format", () => {
  describe("USD", () => {
    it("formats a typical amount", () => {
      expect(format(1234.56, "USD")).toBe("$1 234.56");
    });

    it("formats a small amount", () => {
      expect(format(45, "USD")).toBe("$45.00");
    });

    it("formats zero", () => {
      expect(format(0, "USD")).toBe("$0.00");
    });

    it("formats a negative amount", () => {
      expect(format(-1234.56, "USD")).toBe("-$1 234.56");
    });

    it("formats amounts in the millions", () => {
      expect(format(1000000, "USD")).toBe("$1 000 000.00");
    });
  });

  describe("EUR", () => {
    it("formats a typical amount", () => {
      expect(format(1234.56, "EUR")).toBe("€1 234.56");
    });

    it("formats a small amount", () => {
      expect(format(50, "EUR")).toBe("€50.00");
    });

    it("formats zero", () => {
      expect(format(0, "EUR")).toBe("€0.00");
    });

    it("formats a negative amount", () => {
      expect(format(-50, "EUR")).toBe("-€50.00");
    });
  });

  describe("DKK", () => {
    it("formats a typical amount", () => {
      expect(format(1234.56, "DKK")).toBe("1 234.56 DKK");
    });

    it("formats a small amount", () => {
      expect(format(375, "DKK")).toBe("375.00 DKK");
    });

    it("formats zero", () => {
      expect(format(0, "DKK")).toBe("0.00 DKK");
    });

    it("formats a negative amount", () => {
      expect(format(-1234.56, "DKK")).toBe("-1 234.56 DKK");
    });
  });

  describe("SEK", () => {
    it("formats a typical amount", () => {
      expect(format(1234.56, "SEK")).toBe("1 234.56 SEK");
    });

    it("formats a small amount", () => {
      expect(format(375, "SEK")).toBe("375.00 SEK");
    });

    it("formats zero", () => {
      expect(format(0, "SEK")).toBe("0.00 SEK");
    });

    it("formats a negative amount", () => {
      expect(format(-1234.56, "SEK")).toBe("-1 234.56 SEK");
    });
  });

  describe("decimal handling", () => {
    it("rounds to 2 decimal places", () => {
      expect(format(1.006, "USD")).toBe("$1.01");
    });

    it("pads single decimal digit", () => {
      expect(format(10.5, "EUR")).toBe("€10.50");
    });
  });
});

describe("convert", () => {
  const rates = { USD: 1, EUR: 0.92, DKK: 6.87, SEK: 10.45 };

  it("converts USD to EUR", () => {
    expect(convert(100, "USD", "EUR", rates)).toBeCloseTo(92, 5);
  });

  it("converts EUR to DKK", () => {
    expect(convert(50, "EUR", "DKK", rates)).toBeCloseTo(373.37, 1);
  });

  it("converts same currency (identity)", () => {
    expect(convert(100, "USD", "USD", rates)).toBeCloseTo(100, 5);
  });

  it("converts DKK to SEK", () => {
    expect(convert(687, "DKK", "SEK", rates)).toBeCloseTo(1045, 0);
  });

  it("throws a descriptive error when the from currency rate is missing", () => {
    const partialRates = { EUR: 0.92, DKK: 6.87, SEK: 10.45 } as Record<string, number>;
    expect(() => convert(100, "USD", "EUR", partialRates)).toThrow(
      "Missing exchange rate for USD"
    );
  });

  it("throws a descriptive error when the to currency rate is missing", () => {
    const partialRates = { USD: 1, DKK: 6.87, SEK: 10.45 } as Record<string, number>;
    expect(() => convert(100, "USD", "EUR", partialRates)).toThrow(
      "Missing exchange rate for EUR"
    );
  });
});
