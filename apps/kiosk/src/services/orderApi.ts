// ============================================================================
// orderApi — kiosk counterpart of apps/order-web/lib/api.ts.
//
// The kiosk now submits through the shared `create-web-order` edge function
// (server-side repricing + transactional cart validation), exactly like the
// web channel, passing channel:'kiosk'. It also reuses the same soft cart
// pre-check RPC (get_cart_validity) and fetches its Sala VIP zones through
// get_orderable_zones (migration 029). This replaces the old client-trusted
// insert path in services/orderService.ts.
// ============================================================================
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import type { CartItem, OrderType } from '@/data/types';

export type PaymentMethod = 'yappy' | 'card_on_delivery';

export interface ZoneSummary {
  id: string;
  label: string;
  allowsManualNumber: boolean;
}

// The cart couldn't be ordered right now — a restaurant closed or an item went
// unavailable between browse and submit. Carries the offending ids so checkout
// can banner exactly what's wrong and offer a one-tap fix. Mirrors the web.
export class CartInvalidError extends Error {
  closedRestaurantIds: string[];
  unavailableItemIds: string[];
  constructor(closedRestaurantIds: string[], unavailableItemIds: string[]) {
    super('cart_invalid');
    this.name = 'CartInvalidError';
    this.closedRestaurantIds = closedRestaurantIds;
    this.unavailableItemIds = unavailableItemIds;
  }
}

export interface CartValidity {
  closedRestaurantIds: string[];
  unavailableItemIds: string[];
}

// Soft pre-check at cart/checkout open — surfaces closed restaurants /
// unavailable items before the user commits. Not authoritative (the edge
// function re-checks at submit); best-effort, so it fails open on error.
export async function validateCart(
  items: { restaurantId?: string; menuItemId: string }[],
): Promise<CartValidity> {
  const { data, error } = await (supabase.rpc as any)('get_cart_validity', {
    p_items: items.map((i) => ({ restaurant_id: i.restaurantId ?? null, menu_item_id: i.menuItemId })),
  });
  if (error || !data) return { closedRestaurantIds: [], unavailableItemIds: [] };
  const d = data as any;
  return {
    closedRestaurantIds: d.closed_restaurant_ids ?? [],
    unavailableItemIds: d.unavailable_item_ids ?? [],
  };
}

// The kiosk has no QR table token, so it reads the orderable (Sala VIP) zones
// for its paired restaurant/food court directly. Palcos are excluded server-side.
export async function fetchZones(): Promise<ZoneSummary[]> {
  const { foodCourtId, restaurantId } = useAuthStore.getState();
  const { data, error } = await (supabase.rpc as any)('get_orderable_zones', {
    p_food_court_id: foodCourtId ?? null,
    p_restaurant_id: foodCourtId ? null : restaurantId ?? null,
  });
  if (error || !data) return [];
  return (data as any[]).map((z) => ({
    id: z.id,
    label: z.label,
    allowsManualNumber: z.allows_manual_number ?? false,
  }));
}

export interface CreateKioskOrderPayload {
  tableId?: string;
  tableNumber?: string;
  orderType: OrderType;
  customerName: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  // Keyed by restaurantId — each restaurant in a food-court cart gets its own note.
  notes?: Record<string, string>;
  items: CartItem[];
}

// Submits via the shared edge function. Repricing is authoritative server-side,
// so we only send ids/quantities/selected options — never client totals.
export async function createOrder(
  payload: CreateKioskOrderPayload,
): Promise<{ orderId: string; orderNumber: number; createdAt: string }> {
  const { mode, restaurantId, foodCourtId } = useAuthStore.getState();

  const body = {
    channel: 'kiosk' as const,
    restaurantId: mode === 'food_court' ? undefined : restaurantId ?? undefined,
    foodCourtId: mode === 'food_court' ? foodCourtId ?? undefined : undefined,
    tableId: payload.tableId,
    tableNumber: payload.tableNumber,
    orderType: payload.orderType,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    paymentMethod: payload.paymentMethod,
    notes: payload.notes,
    items: payload.items.map((item) => ({
      menuItemId: item.menuItem.id,
      restaurantId: item.restaurantId,
      quantity: item.quantity,
      selectedOptionIds: Object.values(item.selectedCustomizations).flat(),
    })),
  };

  const { data, error } = await supabase.functions.invoke('create-web-order', { body });
  if (error) throw new Error(error.message);
  if (data?.error === 'cart_invalid') {
    throw new CartInvalidError(data.closedRestaurantIds ?? [], data.unavailableItemIds ?? []);
  }
  if (data?.error) throw new Error(data.error);
  return { orderId: data.orderId, orderNumber: data.orderNumber, createdAt: data.createdAt };
}
