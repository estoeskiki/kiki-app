-- ============================================================================
-- Migration: 032_dashboard_indexes.sql
-- Description: Index coverage for the filter combinations apps/admin-web
-- introduces. Existing indexes were built for the kiosk/KDS access pattern
-- (always "one restaurant, recent orders"): idx_orders_restaurant_date,
-- idx_orders_restaurant_status, idx_orders_table, idx_sub_orders_restaurant_status.
--
-- The dashboard adds three shapes none of those serve:
--   * food-court-wide reporting  -> (food_court_id, created_at)
--   * channel breakdown          -> (channel, created_at)
--   * platform-wide feed         -> (created_at) with no scope predicate at all
--
-- All ordered DESC to match the "newest first" order every list and time
-- bucket uses, so the planner gets a forward scan instead of a sort.
-- ============================================================================

-- Food-court scoped reporting and the food-court live feed.
CREATE INDEX IF NOT EXISTS idx_orders_food_court_date
  ON public.orders (food_court_id, created_at DESC)
  WHERE food_court_id IS NOT NULL;

-- Channel breakdown ("kiosk vs order-web") over a date window.
CREATE INDEX IF NOT EXISTS idx_orders_channel_date
  ON public.orders (channel, created_at DESC);

-- Platform-admin global feed: no scope predicate, so the scoped indexes above
-- can't be used and without this it is a seq scan + sort on every page load.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- Per-restaurant revenue is aggregated from sub_orders (a food-court order fans
-- out into one sub_order per restaurant, so summing orders.total would
-- double-count). Existing coverage is (restaurant_id, status) only.
CREATE INDEX IF NOT EXISTS idx_sub_orders_restaurant_date
  ON public.sub_orders (restaurant_id, created_at DESC);

-- Top-selling items rolls up order_items by menu_item_id.
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item
  ON public.order_items (menu_item_id)
  WHERE menu_item_id IS NOT NULL;

-- Order detail loads line items per sub_order; only (order_id) was indexed.
CREATE INDEX IF NOT EXISTS idx_order_items_sub_order
  ON public.order_items (sub_order_id)
  WHERE sub_order_id IS NOT NULL;
