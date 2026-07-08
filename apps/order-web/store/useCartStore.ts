import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, MenuItem } from '@/lib/types';

interface CartState {
  items: CartItem[];
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    selectedCustomizations: Record<string, string[]>,
    restaurantId: string,
    restaurantName: string,
  ) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  /** Group items by restaurant — used for the multi-restaurant (mall) cart view */
  getItemsByRestaurant: () => { restaurantId: string; restaurantName: string; items: CartItem[] }[];
  getRestaurantIds: () => string[];
}

function computeLineTotal(menuItem: MenuItem, quantity: number, selectedCustomizations: Record<string, string[]>): number {
  let modifierTotal = 0;
  for (const group of menuItem.customizations) {
    const selectedOptionIds = selectedCustomizations[group.id] ?? [];
    for (const option of group.options) {
      if (selectedOptionIds.includes(option.id)) modifierTotal += option.priceModifier;
    }
  }
  return (menuItem.price + modifierTotal) * quantity;
}

function generateCartItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (menuItem, quantity, selectedCustomizations, restaurantId, restaurantName) => {
        const lineTotal = computeLineTotal(menuItem, quantity, selectedCustomizations);
        const newItem: CartItem = {
          id: generateCartItemId(),
          menuItem,
          quantity,
          selectedCustomizations,
          lineTotal,
          restaurantId,
          restaurantName,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      removeItem: (cartItemId) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== cartItemId) }));
      },

      updateQuantity: (cartItemId, newQty) => {
        if (newQty <= 0) {
          get().removeItem(cartItemId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.id === cartItemId
              ? { ...item, quantity: newQty, lineTotal: computeLineTotal(item.menuItem, newQty, item.selectedCustomizations) }
              : item,
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getSubtotal: () => get().items.reduce((sum, item) => sum + item.lineTotal, 0),

      getItemsByRestaurant: () => {
        const grouped = new Map<string, { restaurantName: string; items: CartItem[] }>();
        for (const item of get().items) {
          if (!grouped.has(item.restaurantId)) grouped.set(item.restaurantId, { restaurantName: item.restaurantName, items: [] });
          grouped.get(item.restaurantId)!.items.push(item);
        }
        return Array.from(grouped.entries()).map(([restaurantId, { restaurantName, items }]) => ({ restaurantId, restaurantName, items }));
      },

      getRestaurantIds: () => Array.from(new Set(get().items.map((item) => item.restaurantId))),
    }),
    { name: 'kiki-order-web-cart' },
  ),
);
