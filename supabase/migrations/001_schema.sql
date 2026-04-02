-- ============================================================================
-- Kiki Platform — Database Schema Migration
-- Multi-tenant restaurant platform with organizations + branches
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ORGANIZATIONS (top-level tenant — the brand)
-- ============================================================================
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. RESTAURANTS (branches / locations)
-- ============================================================================
CREATE TABLE restaurants (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  address     text,
  is_open     boolean NOT NULL DEFAULT false,
  timezone    text NOT NULL DEFAULT 'Europe/Madrid',
  currency    text NOT NULL DEFAULT 'EUR',
  tax_rate    numeric(5,4) NOT NULL DEFAULT 0.1000,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurants_org ON restaurants(org_id);

-- ============================================================================
-- 3. ORG_MEMBERS (links auth.users → org + optional branch)
-- ============================================================================
CREATE TABLE org_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  restaurant_id   uuid REFERENCES restaurants(id) ON DELETE SET NULL,  -- NULL = all branches
  role            text NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'kiosk_device')),
  display_name    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_restaurant ON org_members(restaurant_id);

-- ============================================================================
-- 4. DEVICE_TOKENS (kiosk auto-login, scoped to a branch)
-- ============================================================================
CREATE TABLE device_tokens (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  device_name     text NOT NULL,
  token_hash      text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  last_seen_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_tokens_restaurant ON device_tokens(restaurant_id);

-- ============================================================================
-- 5. CATEGORIES
-- ============================================================================
CREATE TABLE categories (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  icon            text DEFAULT '📦',
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

-- ============================================================================
-- 6. MENU_ITEMS
-- ============================================================================
CREATE TABLE menu_items (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id     uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text DEFAULT '',
  price           integer NOT NULL DEFAULT 0,          -- in cents
  image_url       text DEFAULT '',
  available       boolean NOT NULL DEFAULT true,
  popular         boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);

-- ============================================================================
-- 7. CUSTOMIZATION_GROUPS
-- ============================================================================
CREATE TABLE customization_groups (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id    uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  required        boolean NOT NULL DEFAULT false,
  max_selections  integer NOT NULL DEFAULT 1,
  sort_order      integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_customization_groups_item ON customization_groups(menu_item_id);

-- ============================================================================
-- 8. CUSTOMIZATION_OPTIONS
-- ============================================================================
CREATE TABLE customization_options (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        uuid NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  price_modifier  integer NOT NULL DEFAULT 0,           -- in cents, can be negative
  sort_order      integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_customization_options_group ON customization_options(group_id);

-- ============================================================================
-- 9. ORDERS
-- ============================================================================
CREATE TABLE orders (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_number    integer NOT NULL,
  order_type      text NOT NULL CHECK (order_type IN ('dine-in', 'takeaway')),
  status          text NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal        integer NOT NULL DEFAULT 0,
  tax             integer NOT NULL DEFAULT 0,
  total           integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  accepted_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_restaurant_date ON orders(restaurant_id, created_at);

-- ============================================================================
-- 10. ORDER_ITEMS
-- ============================================================================
CREATE TABLE order_items (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id    uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name       text NOT NULL,                        -- snapshot
  item_price      integer NOT NULL,                     -- snapshot in cents
  quantity        integer NOT NULL DEFAULT 1,
  line_total      integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================================================
-- 11. ORDER_ITEM_CUSTOMIZATIONS
-- ============================================================================
CREATE TABLE order_item_customizations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id   uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  group_name      text NOT NULL,                        -- snapshot
  option_name     text NOT NULL,                        -- snapshot
  price_modifier  integer NOT NULL DEFAULT 0            -- snapshot in cents
);

CREATE INDEX idx_order_item_customizations_item ON order_item_customizations(order_item_id);

-- ============================================================================
-- TRIGGER: auto-update updated_at on orders
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_customizations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER: get the restaurant IDs a user can access
-- Owner (restaurant_id IS NULL) → all branches in their org
-- Staff (restaurant_id set) → just that one branch
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_restaurant_ids()
RETURNS uuid[] AS $$
  SELECT CASE
    WHEN m.restaurant_id IS NULL THEN
      ARRAY(SELECT r.id FROM restaurants r WHERE r.org_id = m.org_id)
    ELSE
      ARRAY[m.restaurant_id]
  END
  FROM org_members m
  WHERE m.user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the user's org_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM org_members WHERE user_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- RLS POLICIES: organizations
-- ============================================================================
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (id = get_user_org_id());

CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (id = get_user_org_id() AND get_user_role() = 'owner');

-- ============================================================================
-- RLS POLICIES: restaurants
-- ============================================================================
CREATE POLICY "restaurant_select" ON restaurants
  FOR SELECT USING (id = ANY(get_user_restaurant_ids()));

CREATE POLICY "restaurant_update" ON restaurants
  FOR UPDATE USING (id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

CREATE POLICY "restaurant_insert" ON restaurants
  FOR INSERT WITH CHECK (org_id = get_user_org_id() AND get_user_role() = 'owner');

CREATE POLICY "restaurant_delete" ON restaurants
  FOR DELETE USING (org_id = get_user_org_id() AND get_user_role() = 'owner');

-- ============================================================================
-- RLS POLICIES: org_members
-- ============================================================================
CREATE POLICY "members_select" ON org_members
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "members_insert" ON org_members
  FOR INSERT WITH CHECK (org_id = get_user_org_id() AND get_user_role() = 'owner');

CREATE POLICY "members_update" ON org_members
  FOR UPDATE USING (org_id = get_user_org_id() AND get_user_role() = 'owner');

CREATE POLICY "members_delete" ON org_members
  FOR DELETE USING (org_id = get_user_org_id() AND get_user_role() = 'owner');

-- ============================================================================
-- RLS POLICIES: device_tokens
-- ============================================================================
CREATE POLICY "devices_select" ON device_tokens
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

CREATE POLICY "devices_insert" ON device_tokens
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

CREATE POLICY "devices_update" ON device_tokens
  FOR UPDATE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

CREATE POLICY "devices_delete" ON device_tokens
  FOR DELETE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() = 'owner');

-- ============================================================================
-- RLS POLICIES: categories
-- ============================================================================
CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "categories_insert" ON categories
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "categories_update" ON categories
  FOR UPDATE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "categories_delete" ON categories
  FOR DELETE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

-- ============================================================================
-- RLS POLICIES: menu_items
-- ============================================================================
-- Kiosk devices can only see available items
CREATE POLICY "menu_select_kiosk" ON menu_items
  FOR SELECT USING (
    restaurant_id = ANY(get_user_restaurant_ids())
    AND (get_user_role() != 'kiosk_device' OR available = true)
  );

CREATE POLICY "menu_insert" ON menu_items
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "menu_update" ON menu_items
  FOR UPDATE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "menu_delete" ON menu_items
  FOR DELETE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

-- ============================================================================
-- RLS POLICIES: customization_groups
-- ============================================================================
CREATE POLICY "cg_select" ON customization_groups
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "cg_insert" ON customization_groups
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "cg_update" ON customization_groups
  FOR UPDATE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "cg_delete" ON customization_groups
  FOR DELETE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

-- ============================================================================
-- RLS POLICIES: customization_options
-- ============================================================================
CREATE POLICY "co_select" ON customization_options
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "co_insert" ON customization_options
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "co_update" ON customization_options
  FOR UPDATE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

CREATE POLICY "co_delete" ON customization_options
  FOR DELETE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager'));

-- ============================================================================
-- RLS POLICIES: orders
-- ============================================================================
-- Kiosk can INSERT + SELECT, admin can SELECT + UPDATE
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (restaurant_id = ANY(get_user_restaurant_ids()) AND get_user_role() IN ('owner', 'manager', 'staff'));

-- ============================================================================
-- RLS POLICIES: order_items
-- ============================================================================
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()));

-- ============================================================================
-- RLS POLICIES: order_item_customizations
-- ============================================================================
CREATE POLICY "oic_select" ON order_item_customizations
  FOR SELECT USING (restaurant_id = ANY(get_user_restaurant_ids()));

CREATE POLICY "oic_insert" ON order_item_customizations
  FOR INSERT WITH CHECK (restaurant_id = ANY(get_user_restaurant_ids()));

-- ============================================================================
-- ENABLE REALTIME on key tables
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
