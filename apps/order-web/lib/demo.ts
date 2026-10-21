import { localize } from './currency';
import type { CartItem, OrderStatusResult, OrderType, PaymentMethod } from './types';

// Demo storefronts, reachable at /demo-1 and /demo-2 (see app/[demo]). Each
// slug is also the qr_token of that demo food court's only zone (migration
// 047), so the session carries it as tableToken like any scanned QR and the
// rest of the flow needs no special routing.
//
//   demo-1 — real orders: they land in the admin POS and staff advance them.
//            Only the payment step is simulated (create-web-order marks
//            orders of an is_demo food court as paid).
//   demo-2 — nothing is written to the database. The order lives in this
//            browser and the tracker advances one step every 5 seconds.
export const DEMOS = {
  'demo-1': { simulated: false },
  'demo-2': { simulated: true },
} as const;

export type DemoSlug = keyof typeof DEMOS;

export function isDemoSlug(value: string | null | undefined): value is DemoSlug {
  return !!value && Object.hasOwn(DEMOS, value);
}

export function getDemo(tableToken: string | null | undefined) {
  return isDemoSlug(tableToken) ? DEMOS[tableToken] : null;
}

// ---------------------------------------------------------------------------
// Simulated orders (demo-2)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'kiki-demo-orders';
const ID_PREFIX = 'demo-';
const STEP_MS = 5000;
const STEPS = ['confirmed', 'preparing', 'ready', 'completed'] as const;

// The order as placed — status is derived from createdAt on every read.
type StoredOrder = Omit<OrderStatusResult, 'status' | 'sub_orders'> & {
  sub_orders: Omit<OrderStatusResult['sub_orders'][number], 'status'>[];
};

function readAll(): Record<string, StoredOrder> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function isSimulatedOrderId(orderId: string): boolean {
  return orderId.startsWith(ID_PREFIX);
}

export function createSimulatedOrder(args: {
  groups: { restaurantId: string; restaurantName: string; items: CartItem[] }[];
  getTaxRate: (restaurantId: string) => number;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  tableLabel: string | null;
  tableNumber: string | null;
}): { orderId: string; orderNumber: number } {
  const orderId = ID_PREFIX + crypto.randomUUID();
  const orderNumber = 100 + Math.floor(Math.random() * 900);

  const subOrders = args.groups.map((g) => {
    const subtotal = g.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const tax = Math.round(subtotal * args.getTaxRate(g.restaurantId));
    return {
      restaurant_name: g.restaurantName,
      cancellation_reason: null,
      subtotal,
      tax,
      total: subtotal + tax,
      items: g.items.map((item) => ({
        name: localize(item.menuItem.name),
        quantity: item.quantity,
        item_price: Math.round(item.lineTotal / item.quantity),
        line_total: item.lineTotal,
        customizations: item.menuItem.customizations.flatMap((group) =>
          group.options
            .filter((opt) => (item.selectedCustomizations[group.id] ?? []).includes(opt.id))
            .map((opt) => localize(opt.name)),
        ),
      })),
    };
  });

  const subtotal = subOrders.reduce((sum, s) => sum + s.subtotal, 0);
  const tax = subOrders.reduce((sum, s) => sum + s.tax, 0);
  const order: StoredOrder = {
    order_number: orderNumber,
    order_type: args.orderType,
    table_label: args.tableLabel,
    table_number: args.tableNumber,
    payment_method: args.paymentMethod,
    payment_status: 'paid',
    created_at: new Date().toISOString(),
    subtotal,
    tax,
    total: subtotal + tax,
    sub_orders: subOrders,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [orderId]: order }));
  } catch {
    // Storage blocked (private mode) — the tracker will show not-found. It's a demo.
  }
  return { orderId, orderNumber };
}

// Same contract as getOrderStatus's live/not-found results. Every restaurant
// advances in lockstep: Recibido -> Preparando -> Listo -> Entregado.
export function getSimulatedOrderStatus(orderId: string): OrderStatusResult | null {
  const order = readAll()[orderId];
  if (!order) return null;
  const elapsed = Date.now() - new Date(order.created_at).getTime();
  const status = STEPS[Math.min(STEPS.length - 1, Math.max(0, Math.floor(elapsed / STEP_MS)))];
  return {
    ...order,
    status,
    sub_orders: order.sub_orders.map((s) => ({ ...s, status })),
  };
}
