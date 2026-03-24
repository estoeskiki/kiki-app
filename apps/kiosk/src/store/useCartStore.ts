import { create } from 'zustand';
import type { CartItem, MenuItem } from '@/data/types';
import { config } from '@/constants/config';

interface CartState {
  items: CartItem[];
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    selectedCustomizations: Record<string, string[]>,
  ) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
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

  addItem: (menuItem, quantity, selectedCustomizations) => {
    const lineTotal = computeLineTotal(menuItem, quantity, selectedCustomizations);
    const newItem: CartItem = {
      id: generateCartItemId(),
      menuItem,
      quantity,
      selectedCustomizations,
      lineTotal,
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
}));
