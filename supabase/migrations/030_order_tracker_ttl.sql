-- ============================================================================
-- Migration: 030_order_tracker_ttl.sql
-- Description: Lifecycle for the public order tracker. The order UUID is a
-- forever bearer link — get_order_status_public() would return full order
-- detail for any order, no matter how old. Gate it to a 24h window from
-- created_at. Hard cutoff by time only (status-independent).
--
-- Three outcomes, so the tracker page can tell them apart:
--   * order within window      -> full status object
--   * order older than 24h      -> { "expired": true }  (distinct "expired" UI)
--   * order id doesn't exist    -> null                 (generic "not found")
--
-- This only hides the order from the PUBLIC tracker; the underlying order data
-- is untouched — admin history, fiscal invoices and reporting query it through
-- other paths and are unaffected.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_order_status_public(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN o.created_at <= now() - interval '24 hours'
      THEN jsonb_build_object('expired', true)
    ELSE jsonb_build_object(
      'order_number', o.order_number,
      'status', o.status,
      'order_type', o.order_type,
      'table_label', o.table_label,
      'table_number', o.table_number,
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
          'cancellation_reason', so.cancellation_reason,
          'subtotal', so.subtotal,
          'tax', so.tax,
          'total', so.total,
          'items', (
            SELECT jsonb_agg(jsonb_build_object(
              'name', oi.item_name,
              'quantity', oi.quantity,
              'item_price', oi.item_price,
              'line_total', oi.line_total,
              'customizations', (
                SELECT jsonb_agg(oic.option_name ORDER BY oic.id)
                FROM order_item_customizations oic
                WHERE oic.order_item_id = oi.id
              )
            ))
            FROM order_items oi WHERE oi.sub_order_id = so.id
          )
        ))
        FROM sub_orders so
        JOIN restaurants r ON r.id = so.restaurant_id
        WHERE so.order_id = o.id
      )
    )
  END
  FROM orders o
  WHERE o.id = p_order_id;
$function$;

GRANT EXECUTE ON FUNCTION get_order_status_public(uuid) TO anon, authenticated;
