import { create } from 'zustand';
import type { OrderType, PaymentMethod } from '@/lib/types';

export interface LastOrderItem {
  name: string;
  quantity: number;
  lineTotal: number;
  customizationSummary?: string;
}

export interface LastOrderGroup {
  restaurantName: string;
  items: LastOrderItem[];
}

// Ephemeral (not persisted) — set right before navigating to the thank-you
// screen so it can render the full order summary instantly without a round
// trip, and so the customer's name/items never have to travel through a URL.
// A cold visit (refresh, or a shared link) falls back to fetching the
// (slimmer, price-less) summary via get_order_status_public instead.
interface LastOrderState {
  orderId: string | null;
  orderNumber: number | null;
  customerName: string | null;
  orderType: OrderType | null;
  paymentMethod: PaymentMethod | null;
  tableLabel: string | null;
  groups: LastOrderGroup[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  set: (data: {
    orderId: string;
    orderNumber: number;
    customerName: string;
    orderType: OrderType;
    paymentMethod: PaymentMethod;
    tableLabel: string | null;
    groups: LastOrderGroup[];
    subtotal: number;
    tax: number;
    total: number;
  }) => void;
}

export const useLastOrderStore = create<LastOrderState>((set) => ({
  orderId: null,
  orderNumber: null,
  customerName: null,
  orderType: null,
  paymentMethod: null,
  tableLabel: null,
  groups: [],
  subtotal: null,
  tax: null,
  total: null,
  set: (data) => set(data),
}));
