-- ============================================================================
-- FOOD COURTS (physical venues that house multiple restaurant stalls)
-- ============================================================================
CREATE TABLE food_courts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  address     text,
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SUB_ORDERS (per-stall slice of a parent order)
-- Each stall's POS only sees and manages its own sub_orders.
-- ============================================================================
CREATE TABLE sub_orders (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_number    integer NOT NULL,
  customer_name   text,
  order_type      text NOT NULL DEFAULT 'dine-in' CHECK (order_type IN ('dine-in', 'takeaway')),
  status          text NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal        integer NOT NULL DEFAULT 0,
  tax             integer NOT NULL DEFAULT 0,
  total           integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_orders_order ON sub_orders(order_id);
CREATE INDEX idx_sub_orders_restaurant_status ON sub_orders(restaurant_id, status);

-- Auto-update updated_at
CREATE TRIGGER trg_sub_orders_updated_at
  BEFORE UPDATE ON sub_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Link restaurants to an optional food court
ALTER TABLE restaurants
ADD COLUMN food_court_id uuid REFERENCES food_courts(id) ON DELETE SET NULL;

CREATE INDEX idx_restaurants_food_court ON restaurants(food_court_id);

-- Parent order: optional food court scope + customer name
ALTER TABLE orders
ADD COLUMN food_court_id uuid REFERENCES food_courts(id) ON DELETE SET NULL,
ADD COLUMN customer_name text;

-- Device tokens: support food-court-scoped kiosks
ALTER TABLE device_tokens
ADD COLUMN food_court_id uuid REFERENCES food_courts(id) ON DELETE CASCADE;

-- Make restaurant_id nullable (food court kiosks don't have one)
ALTER TABLE device_tokens
ALTER COLUMN restaurant_id DROP NOT NULL;

-- Enforce exactly one scope: either restaurant OR food court, never both, never neither
ALTER TABLE device_tokens
ADD CONSTRAINT chk_device_scope CHECK (
  (restaurant_id IS NOT NULL AND food_court_id IS NULL)
  OR
  (restaurant_id IS NULL AND food_court_id IS NOT NULL)
);

-- Link order_items to sub_orders instead of directly to orders
ALTER TABLE order_items
ADD COLUMN sub_order_id uuid REFERENCES sub_orders(id) ON DELETE CASCADE;

-- Atomically assigns the next sequential order number for today.
-- Scoped to food_court_id (food court mode) or restaurant_id (standalone mode).
-- Resets to 101 every day automatically.
CREATE OR REPLACE FUNCTION next_order_number(
  p_restaurant_id uuid DEFAULT NULL,
  p_food_court_id uuid DEFAULT NULL
) RETURNS integer AS $$
DECLARE
  next_num integer;
BEGIN
  IF p_food_court_id IS NOT NULL THEN
    SELECT COALESCE(MAX(order_number), 100) + 1 INTO next_num
    FROM orders
    WHERE food_court_id = p_food_court_id
      AND created_at >= CURRENT_DATE;
  ELSE
    SELECT COALESCE(MAX(order_number), 100) + 1 INTO next_num
    FROM orders
    WHERE restaurant_id = p_restaurant_id
      AND food_court_id IS NULL
      AND created_at >= CURRENT_DATE;
  END IF;

  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE food_courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_orders ENABLE ROW LEVEL SECURITY;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sub_orders;

-- ── food_courts ──────────────────────────────────────────────────────
-- Any authenticated user whose restaurant belongs to a food court can see it
CREATE POLICY "food_court_select" ON food_courts
  FOR SELECT USING (
    id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE r.id = ANY(get_user_restaurant_ids())
      AND r.food_court_id IS NOT NULL
    )
  );

-- ── sub_orders ───────────────────────────────────────────────────────
-- Each stall can only see/manage its own sub_orders
CREATE POLICY "sub_orders_select" ON sub_orders
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "sub_orders_insert" ON sub_orders
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "sub_orders_update" ON sub_orders
  FOR UPDATE USING (
    restaurant_id = ANY(get_user_restaurant_ids())
    AND get_user_role() IN ('owner', 'manager', 'staff')
  );

-- ── orders (Parent) ──────────────────────────────────────────────────
-- Restaurant staff are EXPLICITLY DENIED access to the parent orders table
-- for food courts. They only interact with their denormalized `sub_orders`.
-- The parent table is only readable by Kiosks and Food Court Venue Admins.

CREATE OR REPLACE FUNCTION sync_parent_order_status()
RETURNS TRIGGER AS $$
DECLARE
  all_ready boolean;
  any_preparing boolean;
BEGIN
  -- Check if ALL sub_orders for this parent are 'ready' or 'completed'
  SELECT
    bool_and(status IN ('ready', 'completed')),
    bool_or(status = 'preparing')
  INTO all_ready, any_preparing
  FROM sub_orders
  WHERE order_id = NEW.order_id;

  IF all_ready THEN
    UPDATE orders SET status = 'ready' WHERE id = NEW.order_id;
  ELSIF any_preparing THEN
    UPDATE orders SET status = 'preparing' WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_parent_order
  AFTER UPDATE ON sub_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_parent_order_status();

-- authenticate_device() is defined in 008_food_court_members.sql
