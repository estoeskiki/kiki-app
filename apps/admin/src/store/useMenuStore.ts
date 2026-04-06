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
  addCategory: (name: { es: string; en: string }, icon: string) => Promise<void>;
  updateCategory: (catId: string, name: { es: string; en: string }, icon: string) => Promise<void>;
  deleteCategory: (catId: string) => Promise<{ hasItems: boolean }>;
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
    const { restaurantId } = useAuthStore.getState();
    const { error } = await supabase.from('menu_items').update({
      name: updates.name,
      description: updates.description,
      price: updates.price,
      category_id: updates.categoryId,
      available: updates.available,
      popular: updates.popular,
    }).eq('id', itemId);

    if (error) return;

    // Persist customization changes (upsert groups + options, delete removed ones)
    if (updates.customizations && restaurantId) {
      // Fetch current group IDs from DB so we know what to delete
      const { data: existingGroups } = await supabase
        .from('customization_groups')
        .select('id')
        .eq('menu_item_id', itemId);

      const existingGroupIds = new Set((existingGroups || []).map((g: any) => g.id));
      const incomingGroupIds = new Set(
        updates.customizations
          .filter((cg) => !cg.id.startsWith('cg-')) // temp IDs are new
          .map((cg) => cg.id)
      );

      // Delete removed groups (cascade deletes their options)
      const toDeleteGroupIds = [...existingGroupIds].filter((id) => !incomingGroupIds.has(id));
      if (toDeleteGroupIds.length > 0) {
        await supabase.from('customization_groups').delete().in('id', toDeleteGroupIds);
      }

      for (const cg of updates.customizations) {
        const isNew = cg.id.startsWith('cg-');
        let groupId = cg.id;

        if (isNew) {
          // Insert new group
          const { data: insertedGroup } = await supabase
            .from('customization_groups')
            .insert({
              menu_item_id: itemId,
              restaurant_id: restaurantId,
              name: cg.name,
              required: cg.required,
              max_selections: cg.maxSelections,
            })
            .select('id')
            .single();
          if (!insertedGroup) continue;
          groupId = insertedGroup.id;
        } else {
          // Update existing group
          await supabase.from('customization_groups').update({
            name: cg.name,
            required: cg.required,
            max_selections: cg.maxSelections,
          }).eq('id', groupId);
        }

        // Fetch current option IDs for this group
        const { data: existingOpts } = await supabase
          .from('customization_options')
          .select('id')
          .eq('group_id', groupId);

        const existingOptIds = new Set((existingOpts || []).map((o: any) => o.id));
        const incomingOptIds = new Set(
          cg.options
            .filter((o) => !o.id.startsWith('opt-'))
            .map((o) => o.id)
        );

        // Delete removed options
        const toDeleteOptIds = [...existingOptIds].filter((id) => !incomingOptIds.has(id));
        if (toDeleteOptIds.length > 0) {
          await supabase.from('customization_options').delete().in('id', toDeleteOptIds);
        }

        for (const opt of cg.options) {
          if (opt.id.startsWith('opt-')) {
            await supabase.from('customization_options').insert({
              group_id: groupId,
              restaurant_id: restaurantId,
              name: opt.name,
              price_modifier: opt.priceModifier,
            });
          } else {
            await supabase.from('customization_options').update({
              name: opt.name,
              price_modifier: opt.priceModifier,
            }).eq('id', opt.id);
          }
        }
      }
    }

    await get().fetchMenu();
  },

  deleteItem: async (itemId) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    if (!error) {
      set((state) => ({
        items: state.items.filter((i) => i.id !== itemId),
      }));
    }
  },

  addCategory: async (name, icon) => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;
    const maxOrder = get().categories.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0);
    const slug = name.es.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { error } = await supabase.from('categories').insert({
      restaurant_id: restaurantId,
      name,
      icon,
      slug: `${slug}-${Date.now()}`,
      sort_order: maxOrder + 1,
    });
    if (!error) await get().fetchMenu();
  },

  updateCategory: async (catId, name, icon) => {
    const { error } = await supabase.from('categories').update({ name, icon }).eq('id', catId);
    if (!error) {
      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === catId ? { ...c, name, icon } : c
        ),
      }));
    }
  },

  deleteCategory: async (catId) => {
    const hasItems = get().items.some((i) => i.categoryId === catId);
    if (hasItems) return { hasItems: true };
    await supabase.from('categories').delete().eq('id', catId);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== catId),
    }));
    return { hasItems: false };
  },
}));
