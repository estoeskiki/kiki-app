import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  orgId: string | null;
  restaurantId: string | null;
  role: string | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  orgId: null,
  restaurantId: null,
  role: null,
  isLoading: true,

  setSession: (session) => {
    if (!session) {
      set({ session: null, user: null, orgId: null, restaurantId: null, role: null });
      return;
    }

    // Attempt to extract metadata
    const user = session.user;
    const meta = user?.user_metadata || {};

    set({
      session,
      user,
      orgId: meta.org_id || null,
      // If no specific restaurant_id is set (like for an owner), default to the Kiki Centro branch for this prototype
      //todo: remove when going to production
      restaurantId: meta.restaurant_id || 'b0000000-0000-0000-0000-000000000001',
      role: meta.role || null,
    });
  },

  initialize: async () => {
    try {
      set({ isLoading: true });
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error.message);
      }

      useAuthStore.getState().setSession(session);

      // Listen for auth changes (login, logout, token refresh)
      supabase.auth.onAuthStateChange((_event, newSession) => {
        useAuthStore.getState().setSession(newSession);
      });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, orgId: null, restaurantId: null, role: null });
  },
}));
