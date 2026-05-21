import { create } from 'zustand';

interface ActivityState {
  lastSeenAt: string | null;
  markSeen: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  lastSeenAt: null,
  markSeen: () => set({ lastSeenAt: new Date().toISOString() }),
}));
