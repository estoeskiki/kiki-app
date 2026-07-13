-- ============================================================================
-- Migration: 020_cancellation_reason.sql
-- Description: Staff must give a reason when cancelling an order from the
-- admin app; the customer sees it on the order-web tracker for that
-- restaurant's cancelled sub_order.
-- ============================================================================

ALTER TABLE sub_orders ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE OR REPLACE FUNCTION public.get_order_status_public(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
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
  FROM orders o
  WHERE o.id = p_order_id;
$function$;
