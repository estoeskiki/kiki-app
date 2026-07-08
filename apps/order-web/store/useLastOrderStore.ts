import { create } from 'zustand';

// Ephemeral (not persisted) — set right before navigating to the thank-you
// screen so it can render instantly without a round trip, and so the
// customer's name never has to travel through a URL. A cold visit (refresh,
// or a shared link) just falls back to fetching via get_order_status_public.
interface LastOrderState {
  orderId: string | null;
  orderNumber: number | null;
  customerName: string | null;
  set: (data: { orderId: string; orderNumber: number; customerName: string }) => void;
}

export const useLastOrderStore = create<LastOrderState>((set) => ({
  orderId: null,
  orderNumber: null,
  customerName: null,
  set: (data) => set(data),
}));
