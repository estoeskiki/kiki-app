import type { CartItem, OrderType } from '@/data/types';
import { config } from '@/constants/config';
import { generateOrderNumber } from '@/utils/generateOrderNumber';

export interface CreateOrderRequest {
  orderType: OrderType;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentTransactionId: string;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: number;
  createdAt: string;
}

/**
 * Generate a UUID-like id for orders.
 */
function generateOrderId(): string {
  return 'ORD-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8);
}

/**
 * Simulate creating an order in the backend system.
 * Resolves after `config.orderDelay` ms.
 */
export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
  await new Promise((resolve) => setTimeout(resolve, config.orderDelay));

  return {
    orderId: generateOrderId(),
    orderNumber: generateOrderNumber(),
    createdAt: new Date().toISOString(),
  };
}
