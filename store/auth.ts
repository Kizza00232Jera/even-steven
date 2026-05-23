import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  pendingInviteToken: string | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setIsLoading: (loading: boolean) => void;
  setPendingInviteToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  pendingInviteToken: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setPendingInviteToken: (pendingInviteToken) => set({ pendingInviteToken }),
}));
