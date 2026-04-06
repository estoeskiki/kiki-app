import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface RestaurantProfile {
  name: string;
  slogan: string;
  welcomeBgUrl: string;
}

interface RestaurantState {
  profile: RestaurantProfile | null;
  isLoading: boolean;
  fetchProfile: (restaurantId: string) => Promise<void>;
  clear: () => void;
}

export const useRestaurantStore = create<RestaurantState>((set) => ({
  profile: null,
  isLoading: false,

  fetchProfile: async (orgId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('organizations')
      .select('name, slogan, welcome_bg_url')
      .eq('id', orgId)
      .single();

    if (!error && data) {
      set({ profile: { name: data.name, slogan: data.slogan ?? '', welcomeBgUrl: data.welcome_bg_url ?? '' } });
    }
    set({ isLoading: false });
  },

  clear: () => set({ profile: null }),
}));
