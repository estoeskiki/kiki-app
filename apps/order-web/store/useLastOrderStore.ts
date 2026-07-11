import { create } from 'zustand';

// Ephemeral (not persisted) — set right before navigating to the order
// tracker so it can show the celebratory "just placed" header (checkmark,
// greeting) and clear the cart on that one visit, without the customer's
// name ever traveling through the URL. Any other visit to the tracker
// (revisit, refresh, shared link) has orderId !== the id here, so it's
// treated as a plain repeat visit — see app/order/[orderId]/page.tsx.
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
