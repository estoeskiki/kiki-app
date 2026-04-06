import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { Order, OrderStatus } from '../data/types';
import { RealtimeChannel } from '@supabase/supabase-js';
interface OrdersState {
  orders: Order[];
  isLoading: boolean;
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
  channel: null,

  fetchOrders: async () => {
    const { restaurantId } = useAuthStore.getState();
    if (!restaurantId) return;

    set({ isLoading: true });
    
    // Fetch active orders (not completed or cancelled)
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, order_item_customizations(*))')
      .eq('restaurant_id', restaurantId)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error.message);
    } else if (data) {
      // Keep it simple and map the relations to the app's internal Order type
      const mappedOrders: Order[] = data.map((d: any) => ({
        id: d.id,
        orderNumber: d.order_number,
        orderType: d.order_type,
        status: d.status,
        subtotal: d.subtotal,
        tax: d.tax,
        total: d.total,
        createdAt: d.created_at,
        transactionId: null,
        items: d.order_items.map((oi: any) => ({
          id: oi.id,
          menuItem: { id: oi.menu_item_id, name: oi.item_name, price: oi.item_price } as any,
          quantity: oi.quantity,
          lineTotal: oi.line_total,
          selectedCustomizations: {}, // we could parse order_item_customizations if needed
        })),
      }));
      set({ orders: mappedOrders });
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
      .channel(`orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
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
    const { error } = await supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId);
    if (!error) {
      // Local optimistic update
      set((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: 'preparing' } : o)),
      }));
    }
  },

  markOrderReady: async (orderId) => {
    const { error } = await supabase.from('orders').update({ status: 'ready' }).eq('id', orderId);
    if (!error) {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: 'ready' } : o)),
      }));
    }
  },

  markOrderCompleted: async (orderId) => {
    const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
    if (!error) {
      set((state) => ({
        orders: state.orders.filter((o) => o.id !== orderId),
      }));
    }
  },

}));
