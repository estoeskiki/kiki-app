-- ============================================================================
-- Migration: 037_fix_top_items_grouping.sql
-- Description: Fixes dashboard_top_items double-counting renamed menu items.
--
-- THE BUG
-- 034 grouped by (menu_item_id, item_name). order_items.item_name is a snapshot
-- taken when the line was sold, so an item that has ever been renamed has
-- several distinct names against one menu_item_id. That produced one row per
-- historical name: menu item d2010000-…-0101 appeared twice, as
-- "Chicken Tenders" (12 units) and "Tenders 5 piezas" (6), instead of once with
-- 18. Both rows carried the same menu_item_id, which React also flagged as a
-- duplicate list key.
--
-- Effect was a silently wrong ranking — a frequently-renamed bestseller could be
-- split into several small bars and pushed out of the top N entirely.
--
-- THE FIX
-- Group on menu_item_id alone, and label with the name the item was most
-- recently sold under (which is what an operator recognises today).
--
-- Lines whose menu_item_id is NULL — the menu item was deleted, and the snapshot
-- is all that remains — still group by name, otherwise every deleted item across
-- the whole platform would collapse into a single meaningless row.
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
    'menu_item_id', menu_item_id,
    'name',         name,
    'quantity',     quantity,
    'revenue_cents', revenue_cents
  ) ORDER BY quantity DESC), '[]'::jsonb)
  FROM (
    SELECT
      oi.menu_item_id,
      -- The name it was most recently sold under, not an arbitrary one.
      (array_agg(oi.item_name ORDER BY f.created_at DESC))[1] AS name,
      SUM(oi.quantity)::bigint   AS quantity,
      SUM(oi.line_total)::bigint AS revenue_cents
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    JOIN order_items oi ON oi.sub_order_id = f.sub_order_id
    WHERE f.status <> 'cancelled'
    GROUP BY
      oi.menu_item_id,
      -- NULL for live items (so they group by id alone); the snapshot name for
      -- orphaned lines whose menu item no longer exists.
      (CASE WHEN oi.menu_item_id IS NULL THEN oi.item_name END)
    ORDER BY quantity DESC
    LIMIT GREATEST(COALESCE(p_limit, 8), 1)
  ) t;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_top_items(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_top_items(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean,integer) TO authenticated;
