import { create } from 'zustand';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { Order, OrderStatus } from '../data/types';
import { RealtimeChannel } from '@supabase/supabase-js';
import { playNewOrderChime } from '../services/notificationSound';
// Realtime can fire many events per second during a rush (each order = one
// sub_orders row + N order_items rows). Coalesce them into at most one refetch
// per window instead of a full refetch per event, which otherwise pins the app
// in a constant reload loop and machine-guns the new-order chime.
const REFETCH_DEBOUNCE_MS = 2000;
// Safety-net poll. Realtime is the fast path, but a websocket can silently die
// while the app stays foregrounded (network blip, ~hourly token refresh,
// server dropping the channel) and postgres_changes never replays what it
// missed. A cheap low-frequency silent refetch guarantees a new order surfaces
// within this window even when realtime is dead — the difference between "it
// intermittently doesn't show until I refresh" and it always showing.
const REALTIME_SAFETY_POLL_MS = 10000;
let refetchTimer: ReturnType<typeof setTimeout> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
// Chime + "new order" detection now live in fetchOrders (not the realtime
// event) so an order chimes no matter how it surfaces — live event, reconnect
// catch-up, foreground catch-up, or the safety poll. knownOrderIds is every
// order id we've already accounted for; hasLoadedOnce suppresses the chime on
// the very first load (so opening the screen doesn't ring for existing orders).
let hasLoadedOnce = false;
const knownOrderIds = new Set<string>();

// True when a freshly mapped order is identical (for display purposes) to the
// one already in the store — lets us keep the OLD object reference so
// React.memo'd cards skip re-rendering, and skip the set() entirely when a
// refetch changed nothing.
function sameOrder(prev: Order, next: Order): boolean {
  return (
    prev.status === next.status &&
    prev.paymentStatus === next.paymentStatus &&
    prev.total === next.total &&
    prev.notes === next.notes &&
    prev.tableLabel === next.tableLabel &&
    prev.tableNumber === next.tableNumber &&
    prev.fiscalInvoiceId === next.fiscalInvoiceId &&
    prev.items.length === next.items.length
  );
}

interface OrdersState {
  orders: Order[];
  isLoading: boolean;
  fetchError: string | null;
  channel: RealtimeChannel | null;
  fetchOrders: (silent?: boolean) => Promise<void>;
  subscribeToOrders: () => void;
  unsubscribeFromOrders: () => void;
  acceptOrder: (orderId: string) => Promise<void>; // Moves to 'preparing'
  markOrderReady: (orderId: string) => Promise<void>; // Moves to 'ready'
  markOrderCompleted: (orderId: string) => Promise<void>; // Moves to 'completed'
  cancelOrder: (orderId: string, reason: string) => Promise<void>; // Moves to 'cancelled'
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  isLoading: false,
  fetchError: null,
  channel: null,

  fetchOrders: async (silent = false) => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;

    // Realtime-triggered refetches run silent so the pull-to-refresh spinner
    // doesn't flicker on every incoming order.
    if (!silent) set({ isLoading: true });

    // Fetch active sub_orders for this specific stall
    const { data, error } = await supabase
      .from('sub_orders')
      .select('*, order_items(*, order_item_customizations(*))')
      .eq('restaurant_id', restaurantId)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error.message);
      set(silent ? { fetchError: error.message } : { fetchError: error.message, isLoading: false });
    } else if (data) {
      set({ fetchError: null });
      try {
        const mappedOrders: Order[] = data.map((d: any) => ({
          id: d.id,
          orderNumber: d.order_number,
          customerName: d.customer_name,
          customerPhone: d.customer_phone,
          orderType: d.order_type,
          status: d.status,
          subtotal: d.subtotal,
          tax: d.tax,
          total: d.total,
          createdAt: d.created_at,
          transactionId: null,
          fiscalInvoiceId: d.fiscal_invoice_id,
          fiscalCufe: d.fiscal_cufe,
          fiscalQrContent: d.fiscal_qr_content,
          channel: d.channel,
          paymentMethod: d.payment_method,
          paymentStatus: d.payment_status,
          tableLabel: d.table_label,
          tableNumber: d.table_number,
          deliveryAddress: d.delivery_address,
          notes: d.notes,
          items: d.order_items ? d.order_items.map((oi: any) => ({
            id: oi.id,
            menuItem: { id: oi.menu_item_id, name: oi.item_name, price: oi.item_price } as any,
            quantity: oi.quantity,
            lineTotal: oi.line_total,
            selectedCustomizations: {},
            customizations: oi.order_item_customizations
              ? oi.order_item_customizations.map((c: any) => c.option_name)
              : [],
          })) : [],
        }));
        // Chime for genuinely new orders, driven by the fetched data rather
        // than a realtime event — so it rings whether the order arrived via a
        // live event, a reconnect/foreground catch-up, or the safety poll.
        // knownOrderIds guards against a double chime when two fetches race
        // (e.g. realtime + poll); hasLoadedOnce suppresses the first load.
        const hasNewOrder = mappedOrders.some(
          (o) => o.status === 'confirmed' && !knownOrderIds.has(o.id),
        );
        for (const o of mappedOrders) knownOrderIds.add(o.id);
        if (hasLoadedOnce && hasNewOrder) playNewOrderChime();
        hasLoadedOnce = true;

        // Structural sharing: reuse the previous object for any order that
        // hasn't visibly changed. During a rush the board holds 100+ orders and
        // refetches run every couple of seconds — without this, every refetch
        // hands React a fully fresh array and every card re-renders, pinning
        // the JS thread and eating taps.
        const prevOrders = get().orders;
        const prevById = new Map(prevOrders.map((o) => [o.id, o]));
        let changed = mappedOrders.length !== prevOrders.length;
        const reconciled = mappedOrders.map((o, i) => {
          const prev = prevById.get(o.id);
          if (prev && sameOrder(prev, o)) {
            if (prevOrders[i] !== prev) changed = true; // same rows, new position
            return prev;
          }
          changed = true;
          return o;
        });
        if (changed) set({ orders: reconciled });
      } catch (err) {
        console.error('[DEV] Error mapping orders:', err);
      }
    }
    if (!silent) set({ isLoading: false });
  },

  subscribeToOrders: () => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;
    
    const currentChannel = get().channel;
    if (currentChannel) {
      get().unsubscribeFromOrders();
    }

    // Coalesce a burst of realtime events into at most one silent refetch per
    // window. The chime + new-order detection live in fetchOrders now.
    const scheduleRefetch = () => {
      if (refetchTimer) return; // a refetch is already queued for this window
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        get().fetchOrders(true);
      }, REFETCH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`sub_orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sub_orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        // Realtime only sends the sub_orders row itself, not nested
        // order_items — refetch to get the full shape regardless of event type.
        () => scheduleRefetch(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        // order_items for a new sub_order are inserted right after it, in a
        // separate statement — this catches up the item list if the
        // sub_orders-triggered fetch above raced ahead of them.
        () => scheduleRefetch(),
      )
      .subscribe((status) => {
        // Fires on the initial join AND on every automatic rejoin after the
        // socket drops and reconnects. Since postgres_changes never replays
        // events missed while disconnected, every (re)subscribe does a silent
        // catch-up fetch — which also chimes for anything that came in during
        // the gap. This is what makes a dropped connection self-heal instead
        // of silently going dead until a manual refresh.
        if (status === 'SUBSCRIBED') get().fetchOrders(true);
      });

    set({ channel });

    // Foreground catch-up: the OS tears down the websocket when the tablet is
    // backgrounded/asleep, and orders that arrived meanwhile are never
    // delivered. Refetch the instant we return to the foreground.
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') get().fetchOrders(true);
    });

    // Safety-net poll — see REALTIME_SAFETY_POLL_MS. Backstops realtime dying
    // while the app stays foregrounded, so orders never require a manual refresh.
    pollInterval = setInterval(() => get().fetchOrders(true), REALTIME_SAFETY_POLL_MS);
  },

  unsubscribeFromOrders: () => {
    const { channel } = get();
    if (refetchTimer) {
      clearTimeout(refetchTimer);
      refetchTimer = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (appStateSub) {
      appStateSub.remove();
      appStateSub = null;
    }
    // Reset new-order tracking so the next mount (or a restaurant switch)
    // doesn't chime for the orders already on the board at first load.
    hasLoadedOnce = false;
    knownOrderIds.clear();
    if (channel) {
      supabase.removeChannel(channel);
      set({ channel: null });
    }
  },

  acceptOrder: async (orderId) => {
    const { error } = await supabase.from('sub_orders').update({ status: 'preparing' }).eq('id', orderId);
    if (!error) {
      // Local optimistic update
      set((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: 'preparing' } : o)),
      }));
    }
  },

  markOrderReady: async (orderId) => {
    const { error } = await supabase.from('sub_orders').update({ status: 'ready' }).eq('id', orderId);
    if (!error) {
      // Fiscal receipt auto-print removed for now — restaurants don't have
      // real fiscal_api_token values yet, so this was printing fake mock
      // CUFE/QR data. Regular tickets still print via OrdersScreen's
      // explicit print buttons (printTicket).
      set((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: 'ready' } : o)),
      }));
    }
  },

  markOrderCompleted: async (orderId) => {
    const { error } = await supabase.from('sub_orders').update({ status: 'completed' }).eq('id', orderId);
    if (!error) {
      set((state) => ({
        orders: state.orders.filter((o) => o.id !== orderId),
      }));
    }
  },

  cancelOrder: async (orderId, reason) => {
    const { error } = await supabase
      .from('sub_orders')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('id', orderId);
    if (!error) {
      set((state) => ({
        orders: state.orders.filter((o) => o.id !== orderId),
      }));
    }
  },

}));
