import { create } from 'zustand';
import type { Order, OrderType } from '@/data/types';

type OrderFlowStatus = 'idle' | 'processing' | 'success' | 'failed';

interface OrderState {
  orderType: OrderType | null;
  customerName: string | null;
  currentOrder: Order | null;
  orderStatus: OrderFlowStatus;
  setOrderType: (type: OrderType) => void;
  setCustomerName: (name: string) => void;
  setCurrentOrder: (order: Order) => void;
  setOrderStatus: (status: OrderFlowStatus) => void;
  resetOrder: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orderType: null,
  customerName: null,
  currentOrder: null,
  orderStatus: 'idle',

  setOrderType: (type) => {
    set({ orderType: type });
  },

  setCustomerName: (name) => {
    set({ customerName: name });
  },

  setCurrentOrder: (order) => {
    set({ currentOrder: order });
  },

  setOrderStatus: (status) => {
    set({ orderStatus: status });
  },

  resetOrder: () => {
    set({
      orderType: null,
      customerName: null,
      currentOrder: null,
      orderStatus: 'idle',
    });
  },
}));
