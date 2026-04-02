import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { MenuItem, Category } from '../data/types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface MenuState {
  items: MenuItem[];
  categories: Category[];
  isLoading: boolean;
  channel: RealtimeChannel | null;
  fetchMenu: () => Promise<void>;
  subscribeToMenu: () => void;
  unsubscribeFromMenu: () => void;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  categories: [],
  isLoading: false,
  channel: null,

  fetchMenu: async () => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;

    set({ isLoading: true });

    // Fetch categories and items
    // RLS in Kiosk mode limits to "available" items based on our schema policies
    const [{ data: catData }, { data: itemData }] = await Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('menu_items')
        .select(`
          *,
          customization_groups (
            *,
            customization_options (*)
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('sort_order'),
    ]);

    if (catData) set({ categories: catData.map(c => ({...c, sortOrder: c.sort_order})) as any });
    
    if (itemData) {
      const mappedItems = itemData.map((d: any) => ({
        id: d.id,
        categoryId: d.category_id,
        name: d.name,
        description: d.description,
        price: d.price,
        image: d.image_url,
        available: d.available,
        popular: d.popular,
        customizations: d.customization_groups.map((cg: any) => ({
          id: cg.id,
          name: cg.name,
          required: cg.required,
          maxSelections: cg.max_selections,
          options: cg.customization_options.map((co: any) => ({
            id: co.id,
            name: co.name,
            priceModifier: co.price_modifier,
          })),
        })).sort((a: any, b: any) => a.required === b.required ? 0 : a.required ? -1 : 1), // Sort required first
      }));
      set({ items: mappedItems });
    }
    
    set({ isLoading: false });
  },

  subscribeToMenu: () => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;
    
    const currentChannel = get().channel;
    if (currentChannel) {
      get().unsubscribeFromMenu();
    }

    const channel = supabase
      .channel(`menu-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          // Re-fetch entire menu on any change (price change, availability toggle)
          get().fetchMenu();
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribeFromMenu: () => {
    const { channel } = get();
    if (channel) {
      supabase.removeChannel(channel);
      set({ channel: null });
    }
  },
}));
