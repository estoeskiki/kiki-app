-- 023_restaurant_visibility.sql
-- Adds a soft visibility flag to restaurants so we can hide storefronts from the
-- public catalog without deleting their data. Hidden restaurants disappear from
-- the food-court directory and 404 when accessed directly by slug.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Rebuild the public storefront RPC to skip inactive restaurants.
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
    SELECT id INTO v_restaurant_id FROM restaurants WHERE slug = p_slug AND is_active = true;
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
      'table_allows_manual_number', COALESCE(v_table.allows_manual_number, false),
      'zones', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', t.id, 'label', t.label, 'allows_manual_number', t.allows_manual_number
        ) ORDER BY t.label), '[]'::jsonb)
        FROM tables t WHERE t.restaurant_id = r.id AND t.is_active = true
      )
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
        ) ORDER BY r.name)
        FROM restaurants r WHERE r.food_court_id = fc.id AND r.is_active = true
      ),
      'table_id', v_table.id,
      'table_label', v_table.label,
      'table_allows_manual_number', COALESCE(v_table.allows_manual_number, false),
      'zones', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', t.id, 'label', t.label, 'allows_manual_number', t.allows_manual_number
        ) ORDER BY t.label), '[]'::jsonb)
        FROM tables t WHERE t.food_court_id = fc.id AND t.is_active = true
      )
    ) INTO result
    FROM food_courts fc WHERE fc.id = v_food_court_id;
  END IF;

  RETURN result;
END;
$function$;

-- Hide all COS Sports Plaza restaurants except El Invernadero and Stadium Eats.
UPDATE restaurants SET is_active = false
WHERE food_court_id = 'fc200000-0000-0000-0000-000000000001'
  AND id NOT IN (
    'b2000000-0000-0000-0000-000000000001', -- El Invernadero
    'b2000000-0000-0000-0000-000000000002'  -- Stadium Eats
  );
