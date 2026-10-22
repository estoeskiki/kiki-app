// ============================================================================
// Server-side cart pricing for yappy-create.
//
// A COPY (not an extraction) of steps 1–5 of create-web-order/index.ts:
// resolve the table token, scope, open restaurants, available items,
// required customizations and repricing. Copied so the Yappy rollout cannot
// change a single byte of the order path COS depends on. Consolidating the
// two is a follow-up, in its own deploy with a COS smoke test.
//
// Output is the insert-ready snapshot yappy_apply_ipn (migration 049) turns
// into orders/sub_orders/order_items/order_item_customizations.
// ============================================================================
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type OrderType = 'dine-in' | 'takeaway' | 'delivery'

export interface CartItemInput {
  menuItemId: string
  restaurantId?: string
  quantity: number
  selectedOptionIds: string[]
}

export interface PriceCartBody {
  tableToken: string
  tableId?: string
  tableNumber?: string
  orderType: OrderType
  customerName: string
  customerPhone?: string
  deliveryAddress?: Record<string, unknown>
  notes?: Record<string, string>
  items: CartItemInput[]
}

export interface SnapshotItem {
  menu_item_id: string
  item_name: string
  item_price: number
  quantity: number
  line_total: number
  customizations: { group_name: string; option_name: string; price_modifier: number }[]
}

export interface Snapshot {
  order: {
    restaurant_id: string
    order_type: OrderType
    subtotal: number
    tax: number
    total: number
    customer_name: string
    customer_phone: string | null
    table_id: string | null
    table_label: string | null
    table_number: string | null
    delivery_address: Record<string, unknown> | null
  }
  sub_orders: {
    restaurant_id: string
    subtotal: number
    tax: number
    total: number
    notes: string | null
    items: SnapshotItem[]
  }[]
}

export type PriceCartResult =
  | {
      ok: true
      foodCourtId: string
      tableId: string | null
      snapshot: Snapshot
      subtotal: number
      tax: number
      total: number
    }
  // `body` uses the same error shapes create-web-order returns (including
  // cart_invalid with the closed/unavailable ids) so the client handles both.
  | { ok: false; status: number; body: Record<string, unknown> }

function localize(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const v = value as Record<string, string>
    return v.es || v.en || 'Item'
  }
  return 'Item'
}

const fail = (status: number, body: Record<string, unknown>): PriceCartResult => ({ ok: false, status, body })

export async function priceCart(supabaseAdmin: SupabaseClient, body: PriceCartBody): Promise<PriceCartResult> {
  if (!body.items?.length) return fail(400, { error: 'items is required' })
  if (!body.orderType || !body.customerName?.trim()) {
    return fail(400, { error: 'orderType and customerName are required' })
  }
  if (body.orderType === 'delivery' && !body.deliveryAddress) {
    return fail(400, { error: 'deliveryAddress is required for delivery orders' })
  }
  // Yappy is only offered on table QR flows, so the token is mandatory here.
  if (!body.tableToken) return fail(400, { error: 'invalid_table_token' })

  // 1. Resolve table — the source of truth for scope, never the client.
  const { data: table, error: tableError } = await supabaseAdmin
    .from('tables')
    .select('id, label, restaurant_id, food_court_id, allows_manual_number')
    .eq('qr_token', body.tableToken)
    .eq('is_active', true)
    .single()
  if (tableError || !table) return fail(400, { error: 'invalid_table_token' })
  if (!table.food_court_id) return fail(400, { error: 'yappy_unavailable' })

  const foodCourtId: string = table.food_court_id
  let tableId: string = table.id
  let tableLabel: string | null = table.label
  let allowsManualNumber: boolean = table.allows_manual_number
  let tableNumber: string | null = null

  // Customer-corrected zone: honored only for a sibling zone of this venue.
  if (body.tableId && body.tableId !== table.id) {
    const { data: override } = await supabaseAdmin
      .from('tables')
      .select('id, label, restaurant_id, food_court_id, allows_manual_number')
      .eq('id', body.tableId)
      .eq('is_active', true)
      .single()
    if (override && override.food_court_id === foodCourtId) {
      tableId = override.id
      tableLabel = override.label
      allowsManualNumber = override.allows_manual_number
    }
  }
  if (allowsManualNumber) tableNumber = body.tableNumber?.trim() || null

  // 2-3. Restaurants + menu items.
  const menuItemIds = [...new Set(body.items.map((i) => i.menuItemId))]
  const [restaurantsResult, menuResult] = await Promise.all([
    supabaseAdmin.from('restaurants').select('id, name, tax_rate, is_open').eq('food_court_id', foodCourtId),
    supabaseAdmin
      .from('menu_items')
      .select('id, restaurant_id, name, price, available, customization_groups(id, name, required, max_selections, selection_rule, customization_options(id, name, price_modifier))')
      .in('id', menuItemIds),
  ])
  const { data: restaurants, error: restaurantsError } = restaurantsResult
  const { data: menuItems, error: menuError } = menuResult
  if (restaurantsError || !restaurants?.length) return fail(404, { error: 'restaurant_not_found' })
  if (menuError || !menuItems) return fail(500, { error: 'failed_to_load_menu' })
  const restaurantById = new Map(restaurants.map((r: any) => [r.id, r]))
  const menuItemById = new Map(menuItems.map((m: any) => [m.id, m]))

  // 4. Reprice every line. Never trust client prices.
  const lines: (SnapshotItem & { restaurantId: string })[] = []
  const unavailableItemIds: string[] = []
  for (const cartItem of body.items) {
    const menuItem: any = menuItemById.get(cartItem.menuItemId)
    if (!menuItem) return fail(400, { error: `menu_item_not_found:${cartItem.menuItemId}` })
    if (!menuItem.available) {
      unavailableItemIds.push(cartItem.menuItemId)
      continue
    }
    const lineRestaurantId = cartItem.restaurantId
    if (!lineRestaurantId || !restaurantById.has(lineRestaurantId)) {
      return fail(400, { error: `invalid_restaurant_for_item:${cartItem.menuItemId}` })
    }
    if (menuItem.restaurant_id !== lineRestaurantId) {
      return fail(400, { error: `item_restaurant_mismatch:${cartItem.menuItemId}` })
    }

    let unitPrice: number = menuItem.price
    const customizations: SnapshotItem['customizations'] = []
    for (const group of (menuItem.customization_groups ?? []) as any[]) {
      const selected = (group.customization_options ?? []).filter((opt: any) =>
        cartItem.selectedOptionIds?.includes(opt.id),
      )
      if (group.required && selected.length === 0) {
        return fail(400, { error: `missing_required_customization:${group.id}` })
      }
      const rule = group.selection_rule as
        | { driver_group_id: string; by_option: Record<string, number>; default: number }
        | null
      let allowedMax = group.max_selections ?? 1
      if (rule) {
        const driverOption = (cartItem.selectedOptionIds ?? []).find(
          (id) => rule.by_option && id in rule.by_option,
        )
        const ruleMax = driverOption ? rule.by_option[driverOption] ?? rule.default : rule.default
        allowedMax = Math.min(ruleMax ?? allowedMax, group.max_selections ?? ruleMax ?? 1)
      }
      if (selected.length > allowedMax) return fail(400, { error: `too_many_selections:${group.id}` })
      for (const opt of selected) {
        unitPrice += opt.price_modifier
        customizations.push({
          group_name: localize(group.name),
          option_name: localize(opt.name),
          price_modifier: opt.price_modifier,
        })
      }
    }

    const quantity = Math.max(1, Math.floor(cartItem.quantity))
    lines.push({
      restaurantId: lineRestaurantId,
      menu_item_id: menuItem.id,
      item_name: localize(menuItem.name),
      item_price: unitPrice,
      quantity,
      line_total: unitPrice * quantity,
      customizations,
    })
  }

  // 5. One sub_order per restaurant; reject closed/unavailable before charging.
  const linesByRestaurant = new Map<string, typeof lines>()
  for (const line of lines) {
    if (!linesByRestaurant.has(line.restaurantId)) linesByRestaurant.set(line.restaurantId, [])
    linesByRestaurant.get(line.restaurantId)!.push(line)
  }
  const closedRestaurantIds = [...linesByRestaurant.keys()].filter(
    (rid) => (restaurantById.get(rid) as any)?.is_open === false,
  )
  if (unavailableItemIds.length > 0 || closedRestaurantIds.length > 0) {
    return fail(200, { error: 'cart_invalid', unavailableItemIds, closedRestaurantIds })
  }

  const subOrders: Snapshot['sub_orders'] = [...linesByRestaurant.entries()].map(([rId, rLines]) => {
    const restaurant: any = restaurantById.get(rId)
    const subtotal = rLines.reduce((sum, l) => sum + l.line_total, 0)
    const tax = Math.round(subtotal * Number(restaurant.tax_rate))
    return {
      restaurant_id: rId,
      subtotal,
      tax,
      total: subtotal + tax,
      notes: body.notes?.[rId]?.trim() || null,
      items: rLines.map(({ restaurantId: _r, ...item }) => item),
    }
  })

  const subtotal = subOrders.reduce((sum, s) => sum + s.subtotal, 0)
  const tax = subOrders.reduce((sum, s) => sum + s.tax, 0)
  const total = subtotal + tax

  return {
    ok: true,
    foodCourtId,
    tableId,
    subtotal,
    tax,
    total,
    snapshot: {
      order: {
        restaurant_id: subOrders[0].restaurant_id,
        order_type: body.orderType,
        subtotal,
        tax,
        total,
        customer_name: body.customerName.trim(),
        customer_phone: body.customerPhone?.trim() || null,
        table_id: tableId,
        table_label: tableLabel,
        table_number: tableNumber,
        delivery_address: body.deliveryAddress ?? null,
      },
      sub_orders: subOrders,
    },
  }
}
