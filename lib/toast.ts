import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'neutral';

interface ToastEntry {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastStore {
  toast: ToastEntry | null;
  show: (message: string, variant?: ToastVariant) => void;
  hide: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  show: (message, variant = 'neutral') =>
    set({ toast: { id: String(Date.now()), message, variant } }),
  hide: () => set({ toast: null }),
}));
