-- ============================================================================
-- Migration: 022_cart_validity.sql
-- Description: Cart validation for the public web ordering channel. Called at
-- cart/checkout open to surface — before the user hits submit — any restaurant
-- that has since closed or any item that's since gone unavailable. This is the
-- soft, cosmetic layer of the funnel: the authoritative check stays in the
-- create-web-order edge function (the transactional gate). Anon-callable like
-- get_public_storefront/get_order_status_public.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_cart_validity(p_items jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'closed_restaurant_ids', COALESCE((
      SELECT jsonb_agg(DISTINCT r.id)
      FROM restaurants r
      WHERE r.is_open = false
        AND r.id IN (
          SELECT (i->>'restaurant_id')::uuid
          FROM jsonb_array_elements(p_items) i
          WHERE i->>'restaurant_id' IS NOT NULL
        )
    ), '[]'::jsonb),
    'unavailable_item_ids', COALESCE((
      SELECT jsonb_agg(DISTINCT m.id)
      FROM menu_items m
      WHERE m.available = false
        AND m.id IN (
          SELECT (i->>'menu_item_id')::uuid
          FROM jsonb_array_elements(p_items) i
          WHERE i->>'menu_item_id' IS NOT NULL
        )
    ), '[]'::jsonb)
  );
$function$;
