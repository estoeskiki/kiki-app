-- ============================================================================
-- Migration: 014_storefront_slogan.sql
-- Description: Per-restaurant/food-court slogan for order-web's Welcome
-- screen (shown under the big restaurant/food-court name). Same pattern as
-- 011_storefront_branding.sql's welcome_bg_url/logo_url.
-- ============================================================================

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slogan text;
ALTER TABLE food_courts ADD COLUMN IF NOT EXISTS slogan text;

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
        'is_open', r.is_open, 'tax_rate', r.tax_rate, 'currency', r.currency,
        'logo_url', r.logo_url, 'welcome_bg_url', r.welcome_bg_url, 'slogan', r.slogan
      ),
      'table_id', v_table.id,
      'table_label', v_table.label
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
      'table_label', v_table.label
    ) INTO result
    FROM food_courts fc WHERE fc.id = v_food_court_id;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_storefront(text, text) TO anon, authenticated;
