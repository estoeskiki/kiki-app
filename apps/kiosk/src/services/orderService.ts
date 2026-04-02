import type { CartItem, OrderType } from '@/data/types';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

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
 * Creates an order in the Supabase backend.
 */
export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
  const { restaurantId } = useAuthStore.getState();
  if (!restaurantId) {
    throw new Error('Device not linked to a restaurant.');
  }

  // 1. Get next daily order number
  const { data: orderNumberData, error: orderNumberError } = await supabase
    .rpc('get_next_order_number', { p_restaurant_id: restaurantId });

  if (orderNumberError) {
    throw new Error(`Failed to generate order number: ${orderNumberError.message}`);
  }

  const orderNumber = parseInt(orderNumberData as string, 10) || 100;

  // 2. Insert order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      order_number: orderNumber,
      order_type: request.orderType,
      status: 'confirmed',
      subtotal: request.subtotal,
      tax: request.tax,
      total: request.total,
    })
    .select('id, created_at')
    .single();

  if (orderError || !orderData) {
    throw new Error(`Failed to create order: ${orderError?.message}`);
  }

  // 3. Insert order items
  for (const item of request.items) {
    const { data: orderItemData, error: orderItemError } = await supabase
      .from('order_items')
      .insert({
        order_id: orderData.id,
        restaurant_id: restaurantId,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        item_price: item.menuItem.price,
        quantity: item.quantity,
        line_total: item.lineTotal,
      })
      .select('id')
      .single();

    if (orderItemError || !orderItemData) {
      console.error('Failed to insert order item', item.menuItem.name, orderItemError);
      continue; // keep going with other items
    }

    // 4. Insert customizations for this item
    const customizationsToInsert = [];
    for (const group of item.menuItem.customizations) {
      const selectedOptionIds = item.selectedCustomizations[group.id] || [];
      for (const optId of selectedOptionIds) {
        const option = group.options.find(o => o.id === optId);
        if (option) {
          customizationsToInsert.push({
            order_item_id: orderItemData.id,
            restaurant_id: restaurantId,
            group_name: group.name,
            option_name: option.name,
            price_modifier: option.priceModifier,
          });
        }
      }
    }

    if (customizationsToInsert.length > 0) {
      await supabase.from('order_item_customizations').insert(customizationsToInsert);
    }
  }

  return {
    orderId: orderData.id,
    orderNumber,
    createdAt: orderData.created_at,
  };
}
