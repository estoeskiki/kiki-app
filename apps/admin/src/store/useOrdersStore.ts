import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { Order, OrderStatus } from '../data/types';
import { RealtimeChannel } from '@supabase/supabase-js';
import { playNewOrderChime } from '../services/notificationSound';
interface OrdersState {
  orders: Order[];
  isLoading: boolean;
  fetchError: string | null;
  channel: RealtimeChannel | null;
  fetchOrders: () => Promise<void>;
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

  fetchOrders: async () => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;

    set({ isLoading: true });
    
    // Fetch active sub_orders for this specific stall
    const { data, error } = await supabase
      .from('sub_orders')
      .select('*, order_items(*, order_item_customizations(*))')
      .eq('restaurant_id', restaurantId)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error.message);
      set({ fetchError: error.message, isLoading: false });
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
        set({ orders: mappedOrders });
      } catch (err) {
        console.error('[DEV] Error mapping orders:', err);
      }
    }
    set({ isLoading: false });
  },

  subscribeToOrders: () => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;
    
    const currentChannel = get().channel;
    if (currentChannel) {
      get().unsubscribeFromOrders();
    }

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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            playNewOrderChime();
          }
          // Realtime only sends the sub_orders row itself, not nested
          // order_items — refetch to get the full shape regardless of event type.
          get().fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          // Safety net: order_items for a new sub_order are inserted right
          // after it, in a separate statement — this catches up the item
          // list if the sub_orders-triggered fetch above raced ahead of them.
          get().fetchOrders();
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribeFromOrders: () => {
    const { channel } = get();
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
