-- ============================================================================
-- Migration: 015_order_status_prices.sql
-- Description: get_order_status_public() now also returns pricing —
-- subtotal/tax/total on the order and each sub_order, plus item_price/
-- line_total per item. Previously omitted as an initial scope decision (not
-- a security concern): the bearer-link trust model already exposes item
-- names/quantities/status to whoever holds the order ID, and prices aren't
-- sensitive beyond that — this just lets the tracker/thank-you cold-visit
-- fallback show real totals instead of "no price available".
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
    'subtotal', o.subtotal,
    'tax', o.tax,
    'total', o.total,
    'sub_orders', (
      SELECT jsonb_agg(jsonb_build_object(
        'restaurant_name', r.name,
        'status', so.status,
        'subtotal', so.subtotal,
        'tax', so.tax,
        'total', so.total,
        'items', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', oi.item_name,
            'quantity', oi.quantity,
            'item_price', oi.item_price,
            'line_total', oi.line_total
          ))
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
