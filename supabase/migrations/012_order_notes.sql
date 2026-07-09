-- ============================================================================
-- Migration: 012_order_notes.sql
-- Description: Free-text customer notes ("comentarios adicionales") on
-- web orders. Mirrors the existing customer_name/customer_phone
-- denormalization pattern — duplicated on both orders and sub_orders so
-- restaurant staff (who read sub_orders) can see it too.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE sub_orders ADD COLUMN IF NOT EXISTS notes text;
