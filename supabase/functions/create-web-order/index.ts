// ============================================================================
// Edge Function: create-web-order
//
// Server-side counterpart to apps/kiosk/src/services/orderService.ts for the
// public web ordering channel (apps/order-web). The kiosk trusts its own
// client-computed totals because it's a controlled physical device — a web
// browser is not, so this function recomputes every price from menu_items /
// customization_options and never trusts client-sent amounts. Uses the
// service-role key (bypasses RLS) the same way generate-fiscal-invoices does.
// ============================================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.10.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type OrderType = 'dine-in' | 'takeaway' | 'delivery'
type PaymentMethod = 'yappy' | 'cash_on_delivery' | 'card_on_delivery'

interface CartItemInput {
  menuItemId: string
  restaurantId?: string // required in food-court mode, one per cart item
  quantity: number
  selectedOptionIds: string[]
}

interface CreateWebOrderBody {
  restaurantId?: string
  foodCourtId?: string
  tableToken?: string
  // Customer-confirmed zone at checkout, which may differ from tableToken's
  // own zone if they corrected it (e.g. a QR card got physically moved).
  // Only honored when it belongs to the same food court/restaurant the
  // token resolved to — see step 1 below.
  tableId?: string
  tableNumber?: string
  orderType: OrderType
  customerName: string
  customerPhone?: string
  paymentMethod: PaymentMethod
  deliveryAddress?: Record<string, unknown>
  // Keyed by restaurantId — each restaurant in the cart gets its own note.
  notes?: Record<string, string>
  items: CartItemInput[]
}

interface PricedLine {
  restaurantId: string
  menuItemId: string
  itemName: string
  itemPrice: number
  quantity: number
  lineTotal: number
  customizations: { groupName: string; optionName: string; priceModifier: number }[]
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function localize(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const v = value as Record<string, string>
    return v.es || v.en || 'Item'
  }
  return 'Item'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body: CreateWebOrderBody = await req.json()

    if (!body.items?.length) {
      return jsonResponse({ error: 'items is required' }, 400)
    }
    if (!body.orderType || !body.paymentMethod || !body.customerName) {
      return jsonResponse({ error: 'orderType, paymentMethod and customerName are required' }, 400)
    }
    if (body.orderType === 'delivery' && !body.deliveryAddress) {
      return jsonResponse({ error: 'deliveryAddress is required for delivery orders' }, 400)
    }

    // 1. Resolve table (if entered via QR) — this is the source of truth for
    // restaurant/food-court scope when present, not whatever the client sends.
    let tableId: string | null = null
    let tableLabel: string | null = null
    let tableNumber: string | null = null
    let restaurantId = body.restaurantId ?? null
    let foodCourtId = body.foodCourtId ?? null

    if (body.tableToken) {
      const { data: table, error: tableError } = await supabaseAdmin
        .from('tables')
        .select('id, label, restaurant_id, food_court_id, allows_manual_number')
        .eq('qr_token', body.tableToken)
        .eq('is_active', true)
        .single()

      if (tableError || !table) {
        return jsonResponse({ error: 'invalid_table_token' }, 400)
      }
      tableId = table.id
      tableLabel = table.label
      restaurantId = table.restaurant_id
      foodCourtId = table.food_court_id
      let allowsManualNumber = table.allows_manual_number

      // Customer corrected the zone at checkout (e.g. QR moved from Palco #1
      // to Palco #2) — only honor it if it's a sibling zone of the one the
      // token actually resolved to, so a client can't jump to an unrelated
      // restaurant/food court's table by sending an arbitrary id.
      if (body.tableId && body.tableId !== table.id) {
        const { data: override } = await supabaseAdmin
          .from('tables')
          .select('id, label, restaurant_id, food_court_id, allows_manual_number')
          .eq('id', body.tableId)
          .eq('is_active', true)
          .single()

        const sameScope = override && (
          (foodCourtId && override.food_court_id === foodCourtId) ||
          (restaurantId && override.restaurant_id === restaurantId)
        )

        if (sameScope) {
          tableId = override.id
          tableLabel = override.label
          allowsManualNumber = override.allows_manual_number
        }
      }

      if (allowsManualNumber) {
        tableNumber = body.tableNumber?.trim() || null
      }
    }

    if (!restaurantId && !foodCourtId) {
      return jsonResponse({ error: 'restaurantId, foodCourtId or tableToken is required' }, 400)
    }

    // 2. Load the restaurant(s) in scope (source of truth for tax_rate + name)
    const { data: restaurants, error: restaurantsError } = foodCourtId
      ? await supabaseAdmin.from('restaurants').select('id, name, tax_rate').eq('food_court_id', foodCourtId)
      : await supabaseAdmin.from('restaurants').select('id, name, tax_rate').eq('id', restaurantId)

    if (restaurantsError || !restaurants?.length) {
      return jsonResponse({ error: 'restaurant_not_found' }, 404)
    }
    const restaurantById = new Map(restaurants.map((r) => [r.id, r]))

    // 3. Load menu items + customizations needed to reprice the cart server-side.
    const menuItemIds = [...new Set(body.items.map((i) => i.menuItemId))]
    const { data: menuItems, error: menuError } = await supabaseAdmin
      .from('menu_items')
      .select('id, restaurant_id, name, price, available, customization_groups(id, name, required, customization_options(id, name, price_modifier))')
      .in('id', menuItemIds)

    if (menuError || !menuItems) {
      return jsonResponse({ error: 'failed_to_load_menu' }, 500)
    }
    const menuItemById = new Map(menuItems.map((m) => [m.id, m]))

    // 4. Reprice every line server-side. Never trust client-sent prices/totals.
    const pricedLines: PricedLine[] = []
    for (const cartItem of body.items) {
      const menuItem = menuItemById.get(cartItem.menuItemId)
      if (!menuItem) return jsonResponse({ error: `menu_item_not_found:${cartItem.menuItemId}` }, 400)
      if (!menuItem.available) return jsonResponse({ error: `menu_item_unavailable:${cartItem.menuItemId}` }, 400)

      const lineRestaurantId = foodCourtId ? cartItem.restaurantId : restaurantId
      if (!lineRestaurantId || !restaurantById.has(lineRestaurantId)) {
        return jsonResponse({ error: `invalid_restaurant_for_item:${cartItem.menuItemId}` }, 400)
      }
      if (menuItem.restaurant_id !== lineRestaurantId) {
        return jsonResponse({ error: `item_restaurant_mismatch:${cartItem.menuItemId}` }, 400)
      }

      let unitPrice = menuItem.price
      const customizations: PricedLine['customizations'] = []
      const groups = (menuItem.customization_groups ?? []) as any[]
      for (const group of groups) {
        const selected = (group.customization_options ?? []).filter((opt: any) =>
          cartItem.selectedOptionIds?.includes(opt.id),
        )
        if (group.required && selected.length === 0) {
          return jsonResponse({ error: `missing_required_customization:${group.id}` }, 400)
        }
        for (const opt of selected) {
          unitPrice += opt.price_modifier
          customizations.push({
            groupName: localize(group.name),
            optionName: localize(opt.name),
            priceModifier: opt.price_modifier,
          })
        }
      }

      const quantity = Math.max(1, Math.floor(cartItem.quantity))
      pricedLines.push({
        restaurantId: lineRestaurantId,
        menuItemId: menuItem.id,
        itemName: localize(menuItem.name),
        itemPrice: unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
        customizations,
      })
    }

    // 5. Group priced lines by restaurant — one sub_order per restaurant,
    // exactly like the kiosk's food-court mode (standalone is just N=1).
    const linesByRestaurant = new Map<string, PricedLine[]>()
    for (const line of pricedLines) {
      if (!linesByRestaurant.has(line.restaurantId)) linesByRestaurant.set(line.restaurantId, [])
      linesByRestaurant.get(line.restaurantId)!.push(line)
    }

    const subOrderPlans = [...linesByRestaurant.entries()].map(([rId, lines]) => {
      const restaurant = restaurantById.get(rId)!
      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
      const tax = Math.round(subtotal * Number(restaurant.tax_rate))
      return { restaurantId: rId, lines, subtotal, tax, total: subtotal + tax }
    })

    const orderSubtotal = subOrderPlans.reduce((sum, p) => sum + p.subtotal, 0)
    const orderTax = subOrderPlans.reduce((sum, p) => sum + p.tax, 0)
    const orderTotal = orderSubtotal + orderTax

    // 6. Sequential daily order number (shared RPC used by kiosk too).
    const { data: orderNumberData, error: orderNumberError } = await supabaseAdmin.rpc('next_order_number', {
      p_restaurant_id: foodCourtId ? null : restaurantId,
      p_food_court_id: foodCourtId ?? null,
    })
    if (orderNumberError) return jsonResponse({ error: `order_number_failed:${orderNumberError.message}` }, 500)
    const orderNumber = parseInt(orderNumberData as unknown as string, 10) || 100

    // 7. Insert the parent order. No single `notes` value makes sense here
    // anymore — each restaurant's note lives on its own sub_order instead.
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        restaurant_id: foodCourtId ? subOrderPlans[0].restaurantId : restaurantId,
        food_court_id: foodCourtId,
        order_number: orderNumber,
        order_type: body.orderType,
        status: 'confirmed',
        subtotal: orderSubtotal,
        tax: orderTax,
        total: orderTotal,
        customer_name: body.customerName,
        customer_phone: body.customerPhone ?? null,
        channel: 'web',
        payment_method: body.paymentMethod,
        payment_status: 'pending',
        table_id: tableId,
        table_label: tableLabel,
        table_number: tableNumber,
        delivery_address: body.deliveryAddress ?? null,
        notes: null,
      })
      .select('id, created_at')
      .single()

    if (orderError || !order) return jsonResponse({ error: `order_insert_failed:${orderError?.message}` }, 500)

    // 8. Insert one sub_order per restaurant + its order_items/customizations.
    for (const plan of subOrderPlans) {
      const { data: subOrder, error: subOrderError } = await supabaseAdmin
        .from('sub_orders')
        .insert({
          order_id: order.id,
          restaurant_id: plan.restaurantId,
          order_number: orderNumber,
          customer_name: body.customerName,
          customer_phone: body.customerPhone ?? null,
          order_type: body.orderType,
          status: 'confirmed',
          subtotal: plan.subtotal,
          tax: plan.tax,
          total: plan.total,
          channel: 'web',
          payment_method: body.paymentMethod,
          payment_status: 'pending',
          table_label: tableLabel,
          table_number: tableNumber,
          delivery_address: body.deliveryAddress ?? null,
          notes: body.notes?.[plan.restaurantId]?.trim() || null,
        })
        .select('id')
        .single()

      if (subOrderError || !subOrder) {
        console.error(`Failed to create sub-order for restaurant ${plan.restaurantId}:`, subOrderError)
        continue
      }

      // Batch-insert every line in one call instead of looping one-by-one —
      // admin's realtime subscription refetches the instant the sub_orders
      // row above commits, and looped awaited inserts left a real window
      // where that refetch could land after only some order_items existed
      // (subtotal/total were still correct since those live on sub_orders
      // itself, but the item list stayed permanently short since nothing
      // re-triggers a fetch once the rest land).
      const { data: insertedItems, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(
          plan.lines.map((line) => ({
            order_id: order.id,
            sub_order_id: subOrder.id,
            restaurant_id: plan.restaurantId,
            menu_item_id: line.menuItemId,
            item_name: line.itemName,
            item_price: line.itemPrice,
            quantity: line.quantity,
            line_total: line.lineTotal,
          })),
        )
        .select('id')

      if (itemsError || !insertedItems) {
        console.error(`Failed to insert order items for sub-order ${subOrder.id}:`, itemsError)
        continue
      }

      const allCustomizations = plan.lines.flatMap((line, idx) =>
        line.customizations.map((c) => ({
          order_item_id: insertedItems[idx].id,
          restaurant_id: plan.restaurantId,
          group_name: c.groupName,
          option_name: c.optionName,
          price_modifier: c.priceModifier,
        })),
      )

      if (allCustomizations.length > 0) {
        await supabaseAdmin.from('order_item_customizations').insert(allCustomizations)
      }
    }

    // 9. Fire fiscal invoice generation the same way the kiosk does — non-fatal.
    try {
      await supabaseAdmin.functions.invoke('generate-fiscal-invoices', { body: { orderId: order.id } })
    } catch (err) {
      console.error('generate-fiscal-invoices failed for web order', order.id, err)
    }

    return jsonResponse({ orderId: order.id, orderNumber, createdAt: order.created_at })
  } catch (error: any) {
    console.error('create-web-order error:', error)
    return jsonResponse({ error: error.message ?? 'unknown_error' }, 500)
  }
})
