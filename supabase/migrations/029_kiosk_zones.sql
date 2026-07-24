-- ============================================================================
-- Migration: 029_kiosk_zones.sql
-- Description: The kiosk is a physical device paired to a restaurant/food court
-- (no QR table token), so it can't reach zones through get_public_storefront's
-- token path, and `tables` has no anon SELECT policy (see 010: staff-only,
-- resolved only via SECURITY DEFINER functions). This exposes the orderable
-- zones for a paired scope so the kiosk checkout can render its zone picker.
--
-- Intentionally returns ONLY Sala VIP style zones (allows_manual_number = true)
-- where the customer types their table number — Palcos (single-spot QR zones)
-- are not selectable from a kiosk.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_orderable_zones(
  p_food_court_id uuid DEFAULT NULL,
  p_restaurant_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'label', t.label,
    'allows_manual_number', t.allows_manual_number
  ) ORDER BY t.label), '[]'::jsonb)
  FROM tables t
  WHERE t.is_active = true
    AND t.allows_manual_number = true          -- Sala VIP only (excludes Palcos)
    AND (
      (p_food_court_id IS NOT NULL AND t.food_court_id = p_food_court_id)
      OR (p_restaurant_id IS NOT NULL AND t.restaurant_id = p_restaurant_id)
    );
$function$;

GRANT EXECUTE ON FUNCTION public.get_orderable_zones(uuid, uuid) TO anon, authenticated;
