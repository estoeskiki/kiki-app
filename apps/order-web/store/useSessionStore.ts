import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
  // Whether the Welcome screen's CTA has already been tapped this storefront
  // visit — lets OrderingGate skip straight past Welcome/OrderType on a
  // re-mount (e.g. back-navigating from a restaurant to the food-court
  // directory) instead of replaying them. Reset only when landing on a
  // genuinely different restaurant/food court (see setFromStorefront).
  hasEnteredOrdering: boolean;
  setFromStorefront: (slug: string | null, tableToken: string | null, data: StorefrontData) => void;
  setOrderType: (orderType: OrderType) => void;
  setHasEnteredOrdering: (value: boolean) => void;
  // "Empezar de nuevo" — lets the customer re-pick Comer aquí / Para llevar
  // without losing their resolved restaurant/food-court/table/cart. Only
  // clears orderType when it wasn't fixed by a table QR (dine-in via QR
  // isn't a choice to redo).
  restartOrdering: () => void;
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
  hasEnteredOrdering: false,
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initial,

      setFromStorefront: (slug, tableToken, data) => {
        const state = get();

        if (data.type === 'restaurant') {
          const isSameStorefront = state.mode === 'restaurant' && state.restaurantId === data.restaurant.id;
          set({
            mode: 'restaurant',
            slug,
            restaurantId: data.restaurant.id,
            foodCourtId: null,
            restaurants: [data.restaurant],
            tableToken,
            tableId: data.tableId,
            tableLabel: data.tableLabel,
            orderType: data.tableLabel ? 'dine-in' : isSameStorefront ? state.orderType : null,
            hasEnteredOrdering: isSameStorefront ? state.hasEnteredOrdering : false,
          });
        } else if (data.type === 'food_court') {
          const isSameStorefront = state.mode === 'food_court' && state.foodCourtId === data.foodCourt.id;
          set({
            mode: 'food_court',
            slug,
            restaurantId: null,
            foodCourtId: data.foodCourt.id,
            restaurants: data.restaurants,
            tableToken,
            tableId: data.tableId,
            tableLabel: data.tableLabel,
            orderType: data.tableLabel ? 'dine-in' : isSameStorefront ? state.orderType : null,
            hasEnteredOrdering: isSameStorefront ? state.hasEnteredOrdering : false,
          });
        }
      },

      setOrderType: (orderType) => set({ orderType }),

      setHasEnteredOrdering: (value) => set({ hasEnteredOrdering: value }),

      restartOrdering: () =>
        set((state) => ({
          hasEnteredOrdering: false,
          orderType: state.tableLabel ? 'dine-in' : null,
        })),

      getTaxRate: (restaurantId) => {
        return get().restaurants.find((r) => r.id === restaurantId)?.taxRate ?? 0.07;
      },

      getRestaurantName: (restaurantId) => {
        return get().restaurants.find((r) => r.id === restaurantId)?.name ?? '';
      },

      reset: () => set(initial),
    }),
    {
      name: 'kiki-order-web-session',
      // sessionStorage (not localStorage): scopes hasEnteredOrdering/orderType
      // to this browser tab's lifetime. With localStorage, completing the
      // Welcome/OrderType flow once would skip it on every future visit to
      // the same link — including from a fresh tab days later — which reads
      // as the link "randomly" opening straight to the restaurant list.
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
