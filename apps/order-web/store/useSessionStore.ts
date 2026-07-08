import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrderType, RestaurantSummary, StorefrontData } from '@/lib/types';

export type OrderingMode = 'restaurant' | 'food_court' | null;

interface SessionState {
  mode: OrderingMode;
  slug: string | null;
  restaurantId: string | null; // set when mode === 'restaurant'
  foodCourtId: string | null; // set when mode === 'food_court'
  restaurants: RestaurantSummary[]; // the restaurant(s) in scope — 1 for standalone, N for a food court
  tableToken: string | null;
  tableId: string | null;
  tableLabel: string | null; // e.g. "Table 12" — set only when reached via QR
  // Chosen once (Comer aquí / Para llevar), like the kiosk's OrderTypeScreen.
  // Preset to 'dine-in' when a table QR was scanned — null means the
  // customer still needs to pick, same as the kiosk showing OrderTypeScreen.
  orderType: OrderType | null;
  setFromStorefront: (slug: string | null, tableToken: string | null, data: StorefrontData) => void;
  setOrderType: (orderType: OrderType) => void;
  getTaxRate: (restaurantId: string) => number;
  getRestaurantName: (restaurantId: string) => string;
  reset: () => void;
}

const initial = {
  mode: null as OrderingMode,
  slug: null,
  restaurantId: null,
  foodCourtId: null,
  restaurants: [] as RestaurantSummary[],
  tableToken: null,
  tableId: null,
  tableLabel: null,
  orderType: null as OrderType | null,
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initial,

      setFromStorefront: (slug, tableToken, data) => {
        if (data.type === 'restaurant') {
          set({
            mode: 'restaurant',
            slug,
            restaurantId: data.restaurant.id,
            foodCourtId: null,
            restaurants: [data.restaurant],
            tableToken,
            tableId: data.tableId,
            tableLabel: data.tableLabel,
            orderType: data.tableLabel ? 'dine-in' : null,
          });
        } else if (data.type === 'food_court') {
          set({
            mode: 'food_court',
            slug,
            restaurantId: null,
            foodCourtId: data.foodCourt.id,
            restaurants: data.restaurants,
            tableToken,
            tableId: data.tableId,
            tableLabel: data.tableLabel,
            orderType: data.tableLabel ? 'dine-in' : null,
          });
        }
      },

      setOrderType: (orderType) => set({ orderType }),

      getTaxRate: (restaurantId) => {
        return get().restaurants.find((r) => r.id === restaurantId)?.taxRate ?? 0.07;
      },

      getRestaurantName: (restaurantId) => {
        return get().restaurants.find((r) => r.id === restaurantId)?.name ?? '';
      },

      reset: () => set(initial),
    }),
    { name: 'kiki-order-web-session' },
  ),
);
