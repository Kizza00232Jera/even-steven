import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type ThemePreference = 'system' | 'light' | 'dark';
const THEME_KEY = 'theme_preference';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  loadPreference: () => Promise<ThemePreference>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: (preference) => {
    set({ preference });
    SecureStore.setItemAsync(THEME_KEY, preference).catch(() => {});
  },
  loadPreference: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      const preference = (stored as ThemePreference | null) ?? 'system';
      set({ preference });
      return preference;
    } catch {
      return 'system';
    }
  },
}));
