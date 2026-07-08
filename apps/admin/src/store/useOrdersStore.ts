import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { Order, OrderStatus } from '../data/types';
import { RealtimeChannel } from '@supabase/supabase-js';
import { printFiscalReceipt } from '../services/printerService';
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
          deliveryAddress: d.delivery_address,
          items: d.order_items ? d.order_items.map((oi: any) => ({
            id: oi.id,
            menuItem: { id: oi.menu_item_id, name: oi.item_name, price: oi.item_price } as any,
            quantity: oi.quantity,
            lineTotal: oi.line_total,
            selectedCustomizations: {},
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
          // Because real-time only sends the root table (orders) payload,
          // for an INSERT, we might need to re-fetch to get nested order_items.
          // For simplicity in the demo, we just refetch all active orders on any change.
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
      set((state) => {
        const orderToPrint = state.orders.find((o) => o.id === orderId);
        if (orderToPrint) {
          // Fire and forget print (could await if we want to block UI)
          printFiscalReceipt(orderToPrint);
        }
        return {
          orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: 'ready' } : o)),
        };
      });
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

}));
