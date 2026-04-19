import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RestaurantProfile {
  name: string;
  slogan: string;
  welcomeBgUrl: string;
}

interface RestaurantState {
  profile: RestaurantProfile | null;
  isOpen: boolean;
  isLoading: boolean;
  channel: RealtimeChannel | null;
  fetchProfile: (orgId: string) => Promise<void>;
  subscribeToStatus: (restaurantId: string) => Promise<void>;
  clear: () => void;
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  profile: null,
  isOpen: true, // Optimistically open
  isLoading: false,
  channel: null,

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

  subscribeToStatus: async (restaurantId: string) => {
    // 1. Fetch initial status
    const { data: restData } = await supabase
      .from('restaurants')
      .select('is_open')
      .eq('id', restaurantId)
      .single();
    
    if (restData) {
      set({ isOpen: restData.is_open });
    }

    // 2. Clear old sub if it exists
    const currentChannel = get().channel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }

    // 3. Subscribe to real-time changes
    const newChannel = supabase
      .channel(`restaurant_status_${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.new && 'is_open' in payload.new) {
            set({ isOpen: payload.new.is_open });
          }
        }
      )
      .subscribe();

    set({ channel: newChannel });
  },

  clear: () => {
    const { channel } = get();
    if (channel) supabase.removeChannel(channel);
    set({ profile: null, isOpen: true, channel: null });
  },
}));
