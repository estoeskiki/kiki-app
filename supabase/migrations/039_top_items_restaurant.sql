-- ============================================================================
-- Migration: 039_top_items_restaurant.sql
-- Description: Carries restaurant_id/restaurant_name through
-- dashboard_top_items so the Overview chart can disambiguate identically-named
-- items from different locations.
--
-- WHY
-- Two restaurants can legitimately sell an item with the same name — live data
-- has "Aros de Cebolla" at both SnackSpot and Kiki Centro, as distinct
-- menu_item_ids. Grouped correctly (037) they are two rows, but rendered with
-- only the item name they read as a duplicate, which is exactly the symptom of
-- the double-counting bug 037 fixed. Returning the restaurant lets the UI append
-- it — and only when the current filter spans more than one restaurant, so a
-- single-restaurant view stays uncluttered.
--
-- Grain is unchanged: still one row per menu item. restaurant_id is picked from
-- the most recent line, matching how `name` is chosen. A menu_item_id belongs to
-- exactly one restaurant by schema (menu_items.restaurant_id), so for live items
-- this is deterministic rather than a "pick one" compromise; the ORDER BY only
-- matters for orphaned lines whose menu item was deleted.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_top_items(
  p_from timestamptz, p_to timestamptz,
  p_restaurant_ids uuid[] DEFAULT NULL, p_food_court_ids uuid[] DEFAULT NULL,
  p_org_ids uuid[] DEFAULT NULL, p_channels text[] DEFAULT NULL,
  p_table_ids uuid[] DEFAULT NULL, p_statuses text[] DEFAULT NULL,
  p_include_unzoned boolean DEFAULT NULL, p_limit integer DEFAULT 8
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menu_item_id',    menu_item_id,
    'name',            name,
    'restaurant_id',   restaurant_id,
    'restaurant_name', restaurant_name,
    'quantity',        quantity,
    'revenue_cents',   revenue_cents
  ) ORDER BY quantity DESC), '[]'::jsonb)
  FROM (
    SELECT
      oi.menu_item_id,
      -- The name and location it was most recently sold under.
      (array_agg(oi.item_name      ORDER BY f.created_at DESC))[1] AS name,
      (array_agg(f.restaurant_id   ORDER BY f.created_at DESC))[1] AS restaurant_id,
      (array_agg(f.restaurant_name ORDER BY f.created_at DESC))[1] AS restaurant_name,
      SUM(oi.quantity)::bigint   AS quantity,
      SUM(oi.line_total)::bigint AS revenue_cents
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    JOIN order_items oi ON oi.sub_order_id = f.sub_order_id
    WHERE f.status <> 'cancelled'
    GROUP BY
      oi.menu_item_id,
      -- NULL for live items (group by id alone); the snapshot name for orphaned
      -- lines whose menu item no longer exists.
      (CASE WHEN oi.menu_item_id IS NULL THEN oi.item_name END)
    ORDER BY quantity DESC
    LIMIT GREATEST(COALESCE(p_limit, 8), 1)
  ) t;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_top_items(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_top_items(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean,integer) TO authenticated;
