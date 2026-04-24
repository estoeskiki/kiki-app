import { create } from 'zustand';
import type { CartItem, MenuItem } from '@/data/types';
import { config } from '@/constants/config';

interface CartState {
  items: CartItem[];
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    selectedCustomizations: Record<string, string[]>,
    restaurantId?: string,
    restaurantName?: string,
  ) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  /** Group items by restaurantId — used in food court cart UI */
  getItemsByRestaurant: () => { restaurantId: string; restaurantName: string; items: CartItem[] }[];
  /** Get unique restaurant IDs in the cart */
  getRestaurantIds: () => string[];
  /** Remove all items from a specific restaurant (e.g. when it closes) */
  removeItemsByRestaurant: (restaurantId: string) => void;
}

/**
 * Compute the line total for a cart item.
 * lineTotal = (basePrice + sum of selected option price modifiers) * quantity
 */
function computeLineTotal(
  menuItem: MenuItem,
  quantity: number,
  selectedCustomizations: Record<string, string[]>,
): number {
  let modifierTotal = 0;

  for (const group of menuItem.customizations) {
    const selectedOptionIds = selectedCustomizations[group.id] ?? [];
    for (const option of group.options) {
      if (selectedOptionIds.includes(option.id)) {
        modifierTotal += option.priceModifier;
      }
    }
  }

  return (menuItem.price + modifierTotal) * quantity;
}

/**
 * Generate a unique id for a cart line item.
 */
function generateCartItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const useCartStore = create<CartState>((set, get) => ({
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
    set((state) => ({
      items: state.items.filter((item) => item.id !== cartItemId),
    }));
  },

  updateQuantity: (cartItemId, newQty) => {
    if (newQty <= 0) {
      get().removeItem(cartItemId);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.id === cartItemId
          ? {
              ...item,
              quantity: newQty,
              lineTotal: computeLineTotal(item.menuItem, newQty, item.selectedCustomizations),
            }
          : item,
      ),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.lineTotal, 0);
  },

  getTax: () => {
    const subtotal = get().getSubtotal();
    return Math.round(subtotal * config.taxRate);
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTax();
  },

  getItemsByRestaurant: () => {
    const items = get().items;
    const grouped = new Map<string, { restaurantName: string; items: CartItem[] }>();

    for (const item of items) {
      const rId = item.restaurantId || 'default';
      const rName = item.restaurantName || '';
      if (!grouped.has(rId)) {
        grouped.set(rId, { restaurantName: rName, items: [] });
      }
      grouped.get(rId)!.items.push(item);
    }

    return Array.from(grouped.entries()).map(([restaurantId, { restaurantName, items: rItems }]) => ({
      restaurantId,
      restaurantName,
      items: rItems,
    }));
  },

  getRestaurantIds: () => {
    const ids = new Set(get().items.map((item) => item.restaurantId).filter(Boolean) as string[]);
    return Array.from(ids);
  },

  removeItemsByRestaurant: (restaurantId) => {
    set((state) => ({
      items: state.items.filter((item) => item.restaurantId !== restaurantId),
    }));
  },
}));

