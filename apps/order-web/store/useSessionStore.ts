import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OrderType, RestaurantSummary, StorefrontData, ZoneSummary } from '@/lib/types';

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
  // True for zones with many physical tables sharing one QR (e.g. "Sala VIP")
  // — the checkout shows an optional free-text table-number field when set.
  tableAllowsManualNumber: boolean;
  // Every other zone/table sharing this food court/restaurant — lets the
  // checkout offer a picker so the customer can correct a QR that got moved
  // to the wrong physical spot (see setTable).
  zones: ZoneSummary[];
  // Defaults to 'dine-in' the moment a storefront resolves — there's no
  // upfront picker screen anymore. Always editable at checkout (Aquí / Para
  // llevar), regardless of whether a table QR was scanned.
  orderType: OrderType;
  // Whether the Welcome screen's CTA has already been tapped this storefront
  // visit — lets OrderingGate skip straight past Welcome on a re-mount (e.g.
  // back-navigating from a restaurant to the food-court directory) instead
  // of replaying it. Reset only when landing on a genuinely different
  // restaurant/food court (see setFromStorefront).
  hasEnteredOrdering: boolean;
  setFromStorefront: (slug: string | null, tableToken: string | null, data: StorefrontData) => void;
  // Customer correction at checkout — switches to a different zone from the
  // `zones` list (e.g. Palco #1 -> Palco #2 because the QR card was moved).
  setTable: (tableId: string) => void;
  setOrderType: (orderType: OrderType) => void;
  setHasEnteredOrdering: (value: boolean) => void;
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
  tableAllowsManualNumber: false,
  zones: [] as ZoneSummary[],
  orderType: 'dine-in' as OrderType,
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
            tableAllowsManualNumber: data.tableAllowsManualNumber,
            zones: data.zones,
            orderType: isSameStorefront ? state.orderType : 'dine-in',
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
            tableAllowsManualNumber: data.tableAllowsManualNumber,
            zones: data.zones,
            orderType: isSameStorefront ? state.orderType : 'dine-in',
            hasEnteredOrdering: isSameStorefront ? state.hasEnteredOrdering : false,
          });
        }
      },

      setTable: (tableId) => {
        const zone = get().zones.find((z) => z.id === tableId);
        if (!zone) return;
        set({ tableId: zone.id, tableLabel: zone.label, tableAllowsManualNumber: zone.allowsManualNumber });
      },

      setOrderType: (orderType) => set({ orderType }),

      setHasEnteredOrdering: (value) => set({ hasEnteredOrdering: value }),

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
