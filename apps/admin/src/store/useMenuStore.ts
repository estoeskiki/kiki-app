import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { MenuItem, Category } from '../data/types';

interface MenuState {
  items: MenuItem[];
  categories: Category[];
  isLoading: boolean;
  fetchMenu: () => Promise<void>;
  toggleItemAvailability: (itemId: string, current: boolean) => Promise<void>;
  updateItemPrice: (itemId: string, newPrice: number) => Promise<void>;
  addItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateItem: (itemId: string, updates: Partial<MenuItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  categories: [],
  isLoading: false,

  fetchMenu: async () => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;

    set({ isLoading: true });

    // Fetch categories
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
        })),
      }));
      set({ items: mappedItems });
    }
    
    set({ isLoading: false });
  },

  toggleItemAvailability: async (itemId, current) => {
    const { error } = await supabase.from('menu_items').update({ available: !current }).eq('id', itemId);
    if (!error) {
      set((state) => ({
        items: state.items.map((i) => (i.id === itemId ? { ...i, available: !current } : i)),
      }));
    }
  },

  updateItemPrice: async (itemId, newPrice) => {
    const { error } = await supabase.from('menu_items').update({ price: newPrice }).eq('id', itemId);
    if (!error) {
      set((state) => ({
        items: state.items.map((i) => (i.id === itemId ? { ...i, price: newPrice } : i)),
      }));
    }
  },

  addItem: async (item) => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;

    // 1. Insert item
    const { data: insertedItem, error } = await supabase.from('menu_items').insert({
      restaurant_id: restaurantId,
      category_id: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      available: item.available,
      popular: item.popular,
    }).select().single();

    if (error || !insertedItem) return console.error(error);

    // 2. Insert customizations (if any)
    for (const group of item.customizations) {
      const { data: insertedGroup } = await supabase.from('customization_groups').insert({
        menu_item_id: insertedItem.id,
        restaurant_id: restaurantId,
        name: group.name,
        required: group.required,
        max_selections: group.maxSelections,
      }).select().single();

      if (insertedGroup && group.options.length > 0) {
        await supabase.from('customization_options').insert(
          group.options.map((opt) => ({
            group_id: insertedGroup.id,
            restaurant_id: restaurantId,
            name: opt.name,
            price_modifier: opt.priceModifier,
          }))
        );
      }
    }

    await get().fetchMenu(); // Re-fetch all to get fully formed relations
  },

  updateItem: async (itemId, updates) => {
    const { error } = await supabase.from('menu_items').update({
      name: updates.name,
      description: updates.description,
      price: updates.price,
      category_id: updates.categoryId,
      available: updates.available,
      popular: updates.popular,
    }).eq('id', itemId);

    if (!error) {
      get().fetchMenu(); // Refetch to sync any complex nested changes like customizations
    }
  },

  deleteItem: async (itemId) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    if (!error) {
      set((state) => ({
        items: state.items.filter((i) => i.id !== itemId),
      }));
    }
  },
}));
