-- ============================================================================
-- Migration: 033_order_visibility.sql
-- Description: Fixes a pre-existing RLS gap that apps/admin-web would otherwise
-- silently inherit as under-reported revenue.
--
-- THE GAP
-- A food-court order is one `orders` row fanned out into one `sub_orders` row
-- per participating restaurant. create-web-order sets the parent's
-- restaurant_id to `subOrderPlans[0].restaurantId` (index.ts:338) — an
-- arbitrary participant. But orders_select only matched
-- `restaurant_id = ANY(get_user_restaurant_ids())`, so a restaurant that isn't
-- the *first* participant could read its own sub_order and yet not the parent
-- order it belongs to. In live data 32 of 89 sub_orders are in exactly that
-- position.
--
-- It has not bitten yet because food-court staff authenticate through
-- food_court_members, and get_user_restaurant_ids() expands that to every
-- restaurant in the court, so they match the parent anyway. It bites precisely
-- for the persona this dashboard adds: an org_members user scoped to a single
-- restaurant that trades inside a food court. Any join through `orders` (which
-- is unavoidable — sub_orders carries neither table_id nor food_court_id) would
-- drop their rows and quietly understate their numbers.
--
-- THE FIX
-- You may read a parent order if you own any of its sub_orders. That is the
-- semantics the product already assumes: the KDS shows you the order you are
-- part of. The EXISTS is served by the existing idx_sub_orders_order index.
--
-- Note orders_insert / orders_update are deliberately NOT widened: participation
-- grants visibility, not the right to rewrite the shared parent row.
-- ============================================================================

ALTER POLICY orders_select ON public.orders
  TO authenticated
  USING (
    is_platform_admin()
    OR (restaurant_id = ANY (get_user_restaurant_ids()))
    OR EXISTS (
      SELECT 1 FROM sub_orders so
      WHERE so.order_id = orders.id
        AND so.restaurant_id = ANY (get_user_restaurant_ids())
    )
  );

-- Same reasoning one level down: order_items and their customizations are
-- already scoped by their own restaurant_id, so no change is needed there.

-- ─── Parent status sync ─────────────────────────────────────────────────────
-- sync_parent_order_status is a trigger on sub_orders that rolls the derived
-- status up to the parent order. It ran SECURITY INVOKER, so the UPDATE on
-- `orders` was subject to the updating user's RLS — for a non-first participant
-- that UPDATE silently matched zero rows and the parent status simply never
-- advanced. No error, no log, just a stale order.
--
-- SECURITY DEFINER is the right call: if you are permitted to move your own
-- sub_order, the derived parent status must follow. The function reads and
-- writes nothing that isn't already implied by that permission. Pinning
-- search_path also clears the function_search_path_mutable advisor warning.
--
-- The status logic itself is unchanged.
CREATE OR REPLACE FUNCTION public.sync_parent_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  all_ready boolean;
  any_preparing boolean;
BEGIN
  SELECT
    bool_and(status IN ('ready', 'completed')),
    bool_or(status = 'preparing')
  INTO all_ready, any_preparing
  FROM sub_orders
  WHERE order_id = NEW.order_id;

  IF all_ready THEN
    UPDATE orders SET status = 'ready' WHERE id = NEW.order_id;
  ELSIF any_preparing THEN
    UPDATE orders SET status = 'preparing' WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$function$;
