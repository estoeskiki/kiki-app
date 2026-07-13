-- ============================================================================
-- Migration: 021_order_items_realtime.sql
-- Description: Admin app now also subscribes to order_items INSERT events as
-- a self-healing safety net against the sub_orders/order_items insert race
-- (see create-web-order/kiosk orderService.ts changes) — requires order_items
-- to actually be in the realtime publication, which it wasn't yet.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
