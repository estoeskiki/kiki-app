-- ============================================================================
-- Migration: 018_food_court_zones.sql
-- Description: Supports food-court-wide QR "zones" (e.g. Palco #1, Palco #2,
-- Sala VIP) as opposed to one-QR-per-physical-table. A zone is just a
-- `tables` row scoped to food_court_id (already supported) with a new
-- allows_manual_number flag — when true, the checkout UI shows an optional
-- free-text "table number" field (since a zone like Sala VIP has many
-- physical tables sharing one QR/card design, and the number itself is only
-- printed on the card, not encoded in the QR).
-- ============================================================================

ALTER TABLE tables ADD COLUMN IF NOT EXISTS allows_manual_number boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number text;
ALTER TABLE sub_orders ADD COLUMN IF NOT EXISTS table_number text;

CREATE OR REPLACE FUNCTION public.get_public_storefront(p_slug text DEFAULT NULL::text, p_table_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'is_open', r.is_open, 'tax_rate', r.tax_rate, 'currency', r.currency,
        'logo_url', r.logo_url, 'welcome_bg_url', r.welcome_bg_url, 'slogan', r.slogan
      ),
      'table_id', v_table.id,
      'table_label', v_table.label,
      'table_allows_manual_number', COALESCE(v_table.allows_manual_number, false)
    ) INTO result
    FROM restaurants r WHERE r.id = v_restaurant_id;
  ELSE
    SELECT jsonb_build_object(
      'type', 'food_court',
      'food_court', jsonb_build_object(
        'id', fc.id, 'slug', fc.slug, 'name', fc.name, 'address', fc.address,
        'welcome_bg_url', fc.welcome_bg_url, 'slogan', fc.slogan
      ),
      'restaurants', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'slug', r.slug, 'name', r.name, 'is_open', r.is_open, 'tax_rate', r.tax_rate,
          'logo_url', r.logo_url
        ))
        FROM restaurants r WHERE r.food_court_id = fc.id
      ),
      'table_id', v_table.id,
      'table_label', v_table.label,
      'table_allows_manual_number', COALESCE(v_table.allows_manual_number, false)
    ) INTO result
    FROM food_courts fc WHERE fc.id = v_food_court_id;
  END IF;

  RETURN result;
END;
$function$;

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

-- Seed the 3 COS Sports Plaza zones. Sala VIP has many physical tables
-- sharing this one QR/card design, so it allows a manually-entered number;
-- the two Palcos are single free-standing zones with no sub-tables.
INSERT INTO tables (food_court_id, restaurant_id, label, allows_manual_number)
VALUES
  ('fc200000-0000-0000-0000-000000000001', NULL, 'Palco #1', false),
  ('fc200000-0000-0000-0000-000000000001', NULL, 'Palco #2', false),
  ('fc200000-0000-0000-0000-000000000001', NULL, 'Sala VIP', true)
ON CONFLICT DO NOTHING;
