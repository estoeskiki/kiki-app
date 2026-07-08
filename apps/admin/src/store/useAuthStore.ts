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
      } else {
        // [DEV AUTO-FIX] If the user has no org_members row (e.g. after db reset),
        // we automatically link them to the seeded Kiki Burgers restaurant.
        console.log('[DEV] Auto-linking orphaned user to Kiki Burgers...');
        const defaultOrgId = 'a0000000-0000-0000-0000-000000000001';
        const defaultRestaurantId = 'b0000000-0000-0000-0000-000000000001';
        
        await supabase.from('org_members').insert({
          user_id: user.id,
          org_id: defaultOrgId,
          restaurant_id: defaultRestaurantId,
          role: 'owner',
          display_name: 'Admin (Auto-linked)'
        });

        set({
          orgId: defaultOrgId,
          restaurantId: defaultRestaurantId,
          role: 'owner',
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

