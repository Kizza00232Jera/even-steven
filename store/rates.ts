import { create } from 'zustand';

interface RatesState {
  rates: Record<string, number> | null;
  fetchRates: () => Promise<void>;
}

export const useRatesStore = create<RatesState>((set, get) => ({
  rates: null,
  fetchRates: async () => {
    if (get().rates !== null) return;
    try {
      const res = await fetch(
        'https://api.frankfurter.app/latest?base=USD&symbols=EUR,DKK,SEK'
      );
      const json = await res.json();
      set({ rates: { USD: 1, ...json.rates } });
    } catch {
      // Rates unavailable — live conversion won't show
    }
  },
}));
