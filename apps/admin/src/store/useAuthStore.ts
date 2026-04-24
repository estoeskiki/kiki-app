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

    const user = session.user;

    // Set session immediately, then fetch membership from DB
    set({ session, user });

    // Fetch the real org_members row for this user
    (async () => {
      const { data, error } = await supabase
        .from('org_members')
        .select('org_id, restaurant_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching org membership:', error.message);
        return;
      }

      if (data) {
        set({
          orgId: data.org_id,
          restaurantId: data.restaurant_id,
          role: data.role,
        });
      }
    })();
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

