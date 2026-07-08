-- ============================================================================
-- Migration: 010_web_ordering.sql
-- Description: Adds the customer-facing web ordering channel — QR-identified
-- physical tables, order channel/payment/delivery tracking, public menu read
-- access, and SECURITY DEFINER RPCs for public storefront browsing + order
-- tracking (no direct anon access to orders/sub_orders/restaurants, since
-- those carry customer PII / secrets).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TABLES (physical tables, identified via a printed QR code)
-- Scoped to exactly one of restaurant (standalone) or food_court (mall mode),
-- mirroring the chk_device_scope pattern already used on device_tokens.
-- ============================================================================
CREATE TABLE tables (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  food_court_id   uuid REFERENCES food_courts(id) ON DELETE CASCADE,
  label           text NOT NULL,                          -- "Table 12" — shown to staff & customer
  qr_token        text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_table_scope CHECK (
    (restaurant_id IS NOT NULL AND food_court_id IS NULL)
    OR
    (restaurant_id IS NULL AND food_court_id IS NOT NULL)
  )
);

CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX idx_tables_food_court ON tables(food_court_id);
CREATE INDEX idx_tables_qr_token ON tables(qr_token);

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Staff can manage tables for restaurants/food courts they belong to.
-- No public policy: tables are only ever resolved via get_public_storefront().
CREATE POLICY "tables_select_staff" ON tables
  FOR SELECT USING (
    (restaurant_id IS NOT NULL AND restaurant_id = ANY(get_user_restaurant_ids()))
    OR
    (food_court_id IS NOT NULL AND food_court_id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE r.id = ANY(get_user_restaurant_ids()) AND r.food_court_id IS NOT NULL
    ))
  );

CREATE POLICY "tables_insert_staff" ON tables
  FOR INSERT WITH CHECK (
    get_user_role() IN ('owner', 'manager')
    AND (
      (restaurant_id IS NOT NULL AND restaurant_id = ANY(get_user_restaurant_ids()))
      OR
      (food_court_id IS NOT NULL AND food_court_id IN (
        SELECT r.food_court_id FROM restaurants r
        WHERE r.id = ANY(get_user_restaurant_ids()) AND r.food_court_id IS NOT NULL
      ))
    )
  );

CREATE POLICY "tables_update_staff" ON tables
  FOR UPDATE USING (
    get_user_role() IN ('owner', 'manager')
    AND (
      (restaurant_id IS NOT NULL AND restaurant_id = ANY(get_user_restaurant_ids()))
      OR
      (food_court_id IS NOT NULL AND food_court_id IN (
        SELECT r.food_court_id FROM restaurants r
        WHERE r.id = ANY(get_user_restaurant_ids()) AND r.food_court_id IS NOT NULL
      ))
    )
  );

-- ============================================================================
-- 2. ORDERS / SUB_ORDERS: web channel, payment, table, delivery fields
-- (mirrored on both, matching the existing denormalization pattern where
-- subtotal/tax/customer_name are already duplicated on both tables)
-- ============================================================================
ALTER TABLE orders
  ADD COLUMN channel text NOT NULL DEFAULT 'kiosk' CHECK (channel IN ('kiosk', 'web')),
  ADD COLUMN payment_method text CHECK (payment_method IN ('yappy', 'cash_on_delivery', 'card_on_delivery')),
  ADD COLUMN payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  ADD COLUMN table_id uuid REFERENCES tables(id) ON DELETE SET NULL,
  ADD COLUMN table_label text,
  ADD COLUMN delivery_address jsonb,
  ADD COLUMN customer_phone text;

ALTER TABLE orders DROP CONSTRAINT orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('dine-in', 'takeaway', 'delivery'));

ALTER TABLE sub_orders
  ADD COLUMN channel text NOT NULL DEFAULT 'kiosk' CHECK (channel IN ('kiosk', 'web')),
  ADD COLUMN payment_method text CHECK (payment_method IN ('yappy', 'cash_on_delivery', 'card_on_delivery')),
  ADD COLUMN payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  ADD COLUMN table_label text,
  ADD COLUMN delivery_address jsonb,
  ADD COLUMN customer_phone text;

ALTER TABLE sub_orders DROP CONSTRAINT sub_orders_order_type_check;
ALTER TABLE sub_orders ADD CONSTRAINT sub_orders_order_type_check CHECK (order_type IN ('dine-in', 'takeaway', 'delivery'));

CREATE INDEX idx_orders_table ON orders(table_id);

-- ============================================================================
-- 3. PUBLIC MENU READ ACCESS
-- No secret columns on these tables — safe to expose to anon. This also
-- enables real Supabase Realtime subscriptions from the web app, same
-- pattern kiosk uses via subscribeToMenu()/subscribeToStatus().
-- Restaurants/food_courts/orders/sub_orders/tables are deliberately NOT
-- opened here (restaurants.fiscal_api_token is secret; orders/sub_orders
-- carry customer PII) — those go through the RPCs below instead.
-- ============================================================================
CREATE POLICY "categories_select_public" ON categories
  FOR SELECT TO anon USING (true);

CREATE POLICY "menu_items_select_public" ON menu_items
  FOR SELECT TO anon USING (available = true);

CREATE POLICY "cg_select_public" ON customization_groups
  FOR SELECT TO anon USING (true);

CREATE POLICY "co_select_public" ON customization_options
  FOR SELECT TO anon USING (true);

-- ============================================================================
-- 4. get_public_storefront(): resolves a QR table token OR a restaurant/food
-- court slug to the public-safe identity needed to render a storefront.
-- Never returns restaurants.fiscal_api_token.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_public_storefront(
  p_slug text DEFAULT NULL,
  p_table_token text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table tables%ROWTYPE;
  v_restaurant_id uuid;
  v_food_court_id uuid;
  result jsonb;
BEGIN
  IF p_table_token IS NOT NULL THEN
    SELECT * INTO v_table FROM tables WHERE qr_token = p_table_token AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'table_not_found');
    END IF;
    v_restaurant_id := v_table.restaurant_id;
    v_food_court_id := v_table.food_court_id;
  ELSIF p_slug IS NOT NULL THEN
    SELECT id INTO v_restaurant_id FROM restaurants WHERE slug = p_slug;
    IF v_restaurant_id IS NULL THEN
      SELECT id INTO v_food_court_id FROM food_courts WHERE slug = p_slug;
    END IF;
  END IF;

  IF v_restaurant_id IS NULL AND v_food_court_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_restaurant_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'type', 'restaurant',
      'restaurant', jsonb_build_object(
        'id', r.id, 'slug', r.slug, 'name', r.name,
        'is_open', r.is_open, 'tax_rate', r.tax_rate, 'currency', r.currency
      ),
      'table_id', v_table.id,
      'table_label', v_table.label
    ) INTO result
    FROM restaurants r WHERE r.id = v_restaurant_id;
  ELSE
    SELECT jsonb_build_object(
      'type', 'food_court',
      'food_court', jsonb_build_object('id', fc.id, 'slug', fc.slug, 'name', fc.name, 'address', fc.address),
      'restaurants', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'slug', r.slug, 'name', r.name, 'is_open', r.is_open, 'tax_rate', r.tax_rate
        ))
        FROM restaurants r WHERE r.food_court_id = fc.id
      ),
      'table_id', v_table.id,
      'table_label', v_table.label
    ) INTO result
    FROM food_courts fc WHERE fc.id = v_food_court_id;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_storefront(text, text) TO anon, authenticated;

-- ============================================================================
-- 5. get_order_status_public(): the order's UUID is the "bearer link" a
-- customer gets after checkout. Returns only whitelisted fields — no
-- customer_name/phone/delivery_address beyond what the requester already
-- has by virtue of holding the link.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_order_status_public(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'order_type', o.order_type,
    'table_label', o.table_label,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'created_at', o.created_at,
    'sub_orders', (
      SELECT jsonb_agg(jsonb_build_object(
        'restaurant_name', r.name,
        'status', so.status,
        'items', (
          SELECT jsonb_agg(jsonb_build_object('name', oi.item_name, 'quantity', oi.quantity))
          FROM order_items oi WHERE oi.sub_order_id = so.id
        )
      ))
      FROM sub_orders so
      JOIN restaurants r ON r.id = so.restaurant_id
      WHERE so.order_id = o.id
    )
  )
  FROM orders o
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION get_order_status_public(uuid) TO anon, authenticated;
