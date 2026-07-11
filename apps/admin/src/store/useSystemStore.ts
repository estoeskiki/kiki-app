import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface SystemState {
  kioskIsOpen: boolean;
  fetchKioskStatus: (restaurantId: string) => Promise<void>;
  toggleKiosk: (restaurantId: string) => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  kioskIsOpen: true,

  fetchKioskStatus: async (restaurantId) => {
    const { data, error } = await supabase.from('restaurants').select('is_open').eq('id', restaurantId).single();
    if (error) {
      console.error('Error fetching kiosk status:', error.message);
      return;
    }
    if (data) set({ kioskIsOpen: data.is_open });
  },

  // Writes to restaurants.is_open — the same field apps/order-web and the
  // kiosk app both read, so this now actually reflects everywhere instead
  // of being local-only admin UI state.
  toggleKiosk: async (restaurantId) => {
    const next = !get().kioskIsOpen;
    set({ kioskIsOpen: next }); // optimistic
    const { error } = await supabase.from('restaurants').update({ is_open: next }).eq('id', restaurantId);
    if (error) {
      console.error('Error updating kiosk status:', error.message);
      set({ kioskIsOpen: !next }); // revert on failure
    }
  },
}));
