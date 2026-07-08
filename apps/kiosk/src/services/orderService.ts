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
  customerName?: string;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: number;
  createdAt: string;
  customerName?: string;
  fiscalData?: any; // The payload returned from the DGI edge function
}

/**
 * Creates an order in the Supabase backend.
 * 
 * Standalone mode: 1 order → 1 sub_order (single restaurant)
 * Food court mode:  1 order → N sub_orders (one per restaurant in cart)
 */
export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
  const { mode, restaurantId, foodCourtId } = useAuthStore.getState();

  if (mode === 'food_court') {
    return createFoodCourtOrder(request, foodCourtId!);
  } else {
    return createStandaloneOrder(request, restaurantId!);
  }
}

// ─── STANDALONE MODE ────────────────────────────────────────────────────────

async function createStandaloneOrder(
  request: CreateOrderRequest,
  restaurantId: string,
): Promise<CreateOrderResult> {
  // 1. Get next daily order number
  const { data: orderNumberData, error: orderNumberError } = await supabase
    .rpc('next_order_number', { p_restaurant_id: restaurantId, p_food_court_id: null });

  if (orderNumberError) {
    throw new Error(`Failed to generate order number: ${orderNumberError.message}`);
  }

  const orderNumber = parseInt(orderNumberData as string, 10) || 100;

  // 2. Insert parent order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      order_number: orderNumber,
      order_type: request.orderType,
      customer_name: request.customerName,
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

  // 3. Insert the sub-order slice for the Admin POS
  const { data: subOrderData, error: subOrderError } = await supabase
    .from('sub_orders')
    .insert({
      order_id: orderData.id,
      restaurant_id: restaurantId,
      order_number: orderNumber,
      customer_name: request.customerName,
      order_type: request.orderType,
      status: 'confirmed',
      subtotal: request.subtotal,
      tax: request.tax,
      total: request.total,
    })
    .select('id')
    .single();

  if (subOrderError || !subOrderData) {
    throw new Error(`Failed to create sub-order ticket: ${subOrderError?.message}`);
  }

  // 4. Insert order items linked to the sub-order
  await insertOrderItems(orderData.id, subOrderData.id, restaurantId, request.items);

  // 5. Generate fiscal invoices synchronously before finishing
  const fiscalData = await generateFiscalInvoices(orderData.id);

  return {
    orderId: orderData.id,
    orderNumber,
    createdAt: orderData.created_at,
    customerName: request.customerName,
    fiscalData,
  };
}

// ─── FOOD COURT MODE ────────────────────────────────────────────────────────

async function createFoodCourtOrder(
  request: CreateOrderRequest,
  foodCourtId: string,
): Promise<CreateOrderResult> {
  // 1. Group items by restaurant
  const byRestaurant = new Map<string, CartItem[]>();
  for (const item of request.items) {
    const rId = item.restaurantId || 'unknown';
    if (!byRestaurant.has(rId)) byRestaurant.set(rId, []);
    byRestaurant.get(rId)!.push(item);
  }

  // 2. Get next order number (scoped to food court)
  const { data: orderNumberData, error: orderNumberError } = await supabase
    .rpc('next_order_number', { p_restaurant_id: null, p_food_court_id: foodCourtId });

  if (orderNumberError) {
    throw new Error(`Failed to generate order number: ${orderNumberError.message}`);
  }

  const orderNumber = parseInt(orderNumberData as string, 10) || 100;

  // 3. Insert parent order (food court scoped, pick first restaurant as nominal)
  const firstRestaurantId = Array.from(byRestaurant.keys())[0];
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      restaurant_id: firstRestaurantId,
      food_court_id: foodCourtId,
      order_number: orderNumber,
      order_type: request.orderType,
      customer_name: request.customerName,
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

  // 4. Create one sub_order per restaurant
  for (const [restaurantId, items] of byRestaurant.entries()) {
    const subSubtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const subTax = Math.round(subSubtotal * 0.1); // TODO: use restaurant-specific tax rate
    const subTotal = subSubtotal + subTax;

    const { data: subOrderData, error: subOrderError } = await supabase
      .from('sub_orders')
      .insert({
        order_id: orderData.id,
        restaurant_id: restaurantId,
        order_number: orderNumber,
        customer_name: request.customerName,
        order_type: request.orderType,
        status: 'confirmed',
        subtotal: subSubtotal,
        tax: subTax,
        total: subTotal,
      })
      .select('id')
      .single();

    if (subOrderError || !subOrderData) {
      console.error(`Failed to create sub-order for restaurant ${restaurantId}:`, subOrderError);
      continue;
    }

    // Insert order items for this sub-order
    await insertOrderItems(orderData.id, subOrderData.id, restaurantId, items);
  }

  // 5. Generate fiscal invoices for all sub_orders simultaneously
  const fiscalData = await generateFiscalInvoices(orderData.id);

  return {
    orderId: orderData.id,
    orderNumber,
    createdAt: orderData.created_at,
    customerName: request.customerName,
    fiscalData,
  };
}

// ─── SHARED: Insert order items + customizations ────────────────────────────

async function insertOrderItems(
  orderId: string,
  subOrderId: string,
  restaurantId: string,
  items: CartItem[],
) {
  for (const item of items) {
    const { data: orderItemData, error: orderItemError } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        restaurant_id: restaurantId,
        sub_order_id: subOrderId,
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
      continue;
    }

    // Insert customizations for this item
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
}

// ─── FISCAL INTEGRATION ─────────────────────────────────────────────────────

async function generateFiscalInvoices(orderId: string) {
  try {
    // [DEV ONLY] Bypassing real Edge Function call so local expo run doesn't fail
    // while the DGI environment is not yet fully configured.
    console.log('[DEV] Bypassing Fiscal Edge Function for Order:', orderId);
    return {
      success: true,
      invoices: [
        {
          subOrderId: 'mock-sub-1',
          restaurantName: 'Kiki Burger',
          cufe: 'FE01234567890ABCDEF1234567890ABCDEF123456789',
          qrContent: 'https://dgi-fep.mef.gob.pa/Consultas/FacturasPorCUFE?cufe=FE01234567890ABCDEF'
        }
      ]
    };
    
    /*
    const { data, error } = await supabase.functions.invoke('generate-fiscal-invoices', {
      body: { orderId }
    });
    
    if (error) throw error;
    return data;
    */
  } catch (err) {
    console.error('Error generating fiscal invoices via Edge Function:', err);
    // Depending on requirements, we return null to proceed without crashing
    return null;
  }
}
